import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ChartModule } from 'primeng/chart';
import { DepotService } from '../../core/services/depot.service';
import {
  DepotDashboard, ContainerVisit, DeliveryOrder, LineOperator, YardBlock,
  ThroughputEntry, StockByOperatorEntry,
} from '../../core/models/depot.models';

type ThroughputMode = 'both' | 'inbound' | 'outbound';

const AURA_PALETTE = [
  '#2563EB', '#E65100', '#059669', '#9333EA', '#DC2626',
  '#0891B2', '#CA8A04', '#DB2777', '#475569', '#14B8A6',
];

@Component({
  selector: 'depot-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ChartModule],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit, OnDestroy {
  dashboard: DepotDashboard | null = null;
  loading = true;
  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  // TF-12 Throughput state
  throughputFrom: string = '';
  throughputTo: string = '';
  throughputMode: ThroughputMode = 'both';
  throughputLoading = false;
  throughputRaw: ThroughputEntry[] = [];
  throughputChartData: any = null;
  throughputChartOptions: any = null;

  // TF-13 Stock-by-operator state
  stockLoading = false;
  stockRaw: StockByOperatorEntry[] = [];
  stockChartData: any = null;
  stockChartOptions: any = null;
  get stockTotal(): number {
    return this.stockRaw.reduce((s, r) => s + r.freshCount + r.longStayCount, 0);
  }
  get stockLongStay(): number {
    return this.stockRaw.reduce((s, r) => s + r.longStayCount, 0);
  }
  get stockLongStayPercent(): number {
    const t = this.stockTotal;
    return t > 0 ? Math.round((this.stockLongStay / t) * 100) : 0;
  }

  constructor(private depotService: DepotService) {}

  ngOnInit() {
    // Default: last 7 days
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 6);
    this.throughputFrom = toInputDate(from);
    this.throughputTo = toInputDate(to);

    this.throughputChartOptions = this.buildLineChartOptions();
    this.stockChartOptions = this.buildStackedBarOptions();

    this.loadDashboard();
    this.loadThroughput();
    this.loadStockByOperator();
    this.refreshInterval = setInterval(() => this.loadDashboard(), 60000);
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  // ── TF-12 Throughput ──────────────────────────────────────────────────
  loadThroughput() {
    const from = parseInputDate(this.throughputFrom);
    const to = parseInputDate(this.throughputTo);
    if (!from || !to) return;
    this.throughputLoading = true;
    this.depotService.getThroughput(from, to).subscribe({
      next: data => {
        this.throughputRaw = data;
        this.throughputChartData = this.buildThroughputChartData(data, this.throughputMode);
        this.throughputLoading = false;
      },
      error: () => {
        this.throughputRaw = [];
        this.throughputChartData = null;
        this.throughputLoading = false;
      },
    });
  }

  setThroughputMode(mode: ThroughputMode) {
    this.throughputMode = mode;
    this.throughputChartData = this.buildThroughputChartData(this.throughputRaw, mode);
  }

  get hasThroughputData(): boolean {
    return this.throughputRaw.length > 0;
  }

  // Throughput KPI getters — feed the summary strip above the chart.
  get throughputInboundTotal(): number {
    return this.throughputRaw.reduce((s, r) => s + r.inboundCount, 0);
  }
  get throughputOutboundTotal(): number {
    return this.throughputRaw.reduce((s, r) => s + r.outboundCount, 0);
  }
  get throughputNet(): number {
    return this.throughputInboundTotal - this.throughputOutboundTotal;
  }
  get throughputPeakDay(): { date: string; total: number } | null {
    if (!this.throughputRaw.length) return null;
    const byDate = new Map<string, number>();
    this.throughputRaw.forEach(e => {
      byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.inboundCount + e.outboundCount);
    });
    const [date, total] = [...byDate.entries()].sort(([, a], [, b]) => b - a)[0];
    return { date, total };
  }
  get throughputTopOperator(): { code: string; total: number } | null {
    if (!this.throughputRaw.length) return null;
    const byOp = new Map<string, number>();
    this.throughputRaw.forEach(e => {
      byOp.set(e.lineOperatorCode, (byOp.get(e.lineOperatorCode) ?? 0) + e.inboundCount + e.outboundCount);
    });
    const [code, total] = [...byOp.entries()].sort(([, a], [, b]) => b - a)[0];
    return { code, total };
  }

  private buildThroughputChartData(entries: ThroughputEntry[], mode: ThroughputMode): any {
    // Build the x-axis from the selected [from, to] range (inclusive) so
    // days with zero activity — especially "today" when BE returns no rows
    // — still show as a tick with value 0 instead of disappearing.
    const dates = this.buildDateRange(this.throughputFrom, this.throughputTo);
    if (!dates.length) return null;
    const operators = Array.from(new Set(entries.map(e => e.lineOperatorCode))).sort();
    if (!operators.length) {
      // No operators in response → still render empty chart over the range.
      return { labels: dates.map(d => this.fmtShortDate(d)), datasets: [] };
    }

    const datasets: any[] = [];
    operators.forEach((op, i) => {
      const color = AURA_PALETTE[i % AURA_PALETTE.length];
      const lookup = new Map<string, ThroughputEntry>();
      entries.filter(e => e.lineOperatorCode === op).forEach(e => lookup.set(e.date, e));

      if (mode === 'both' || mode === 'inbound') {
        datasets.push({
          label: `${op} · Inbound`,
          data: dates.map(d => lookup.get(d)?.inboundCount ?? 0),
          borderColor: color,
          backgroundColor: `${color}22`,
          borderWidth: 2.5,
          tension: 0.4,
          fill: mode === 'inbound',
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: '#fff',
          pointBorderColor: color,
          pointBorderWidth: 2,
        });
      }
      if (mode === 'both' || mode === 'outbound') {
        datasets.push({
          label: `${op} · Outbound`,
          data: dates.map(d => lookup.get(d)?.outboundCount ?? 0),
          borderColor: color,
          backgroundColor: `${color}11`,
          borderWidth: 2,
          borderDash: mode === 'both' ? [5, 4] : undefined,
          tension: 0.4,
          fill: mode === 'outbound',
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: color,
          pointBorderColor: color,
          pointBorderWidth: 0,
        });
      }
    });

    return { labels: dates.map(d => this.fmtShortDate(d)), datasets };
  }

  private fmtShortDate(iso: string): string {
    // "2026-04-15" → "15 Apr"
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
  }

  private buildDateRange(fromIso: string, toIso: string): string[] {
    if (!fromIso || !toIso) return [];
    const from = new Date(fromIso + 'T00:00:00');
    const to = new Date(toIso + 'T00:00:00');
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) return [];
    const out: string[] = [];
    const cursor = new Date(from);
    while (cursor <= to) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const d = String(cursor.getDate()).padStart(2, '0');
      out.push(`${y}-${m}-${d}`);
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }

  private buildLineChartOptions(): any {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            usePointStyle: true,
            boxWidth: 10,
            boxHeight: 10,
            padding: 14,
            font: { size: 11, family: 'system-ui, -apple-system, sans-serif' },
            color: '#555',
          },
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(17, 24, 39, 0.96)',
          titleColor: '#fff',
          titleFont: { weight: 'bold', size: 12 },
          bodyColor: '#E5E7EB',
          bodyFont: { size: 11 },
          padding: 10,
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          cornerRadius: 6,
          usePointStyle: true,
          boxPadding: 6,
          callbacks: {
            title: (items: any[]) => items[0]?.label ?? '',
            label: (ctx: any) => ` ${ctx.dataset.label}: ${ctx.parsed.y}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false },
          ticks: { color: '#666', font: { size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.06)', drawBorder: false },
          ticks: { precision: 0, color: '#666', font: { size: 11 }, padding: 6 },
        },
      },
    };
  }

  // ── TF-13 Stock by Operator ────────────────────────────────────────────
  loadStockByOperator() {
    this.stockLoading = true;
    this.depotService.getStockByOperator().subscribe({
      next: data => {
        this.stockRaw = data;
        this.stockChartData = this.buildStockChartData(data);
        this.stockLoading = false;
      },
      error: () => {
        this.stockRaw = [];
        this.stockChartData = null;
        this.stockLoading = false;
      },
    });
  }

  get hasStockData(): boolean {
    return this.stockRaw.length > 0;
  }

  get stockTopOperator(): { code: string; total: number } | null {
    if (!this.stockRaw.length) return null;
    const sorted = [...this.stockRaw]
      .map(r => ({ code: r.lineOperatorCode, total: r.freshCount + r.longStayCount }))
      .sort((a, b) => b.total - a.total);
    return sorted[0] ?? null;
  }

  get stockWorstLongStay(): { code: string; percent: number } | null {
    if (!this.stockRaw.length) return null;
    const sorted = [...this.stockRaw]
      .map(r => {
        const total = r.freshCount + r.longStayCount;
        return { code: r.lineOperatorCode, percent: total > 0 ? Math.round((r.longStayCount / total) * 100) : 0 };
      })
      .sort((a, b) => b.percent - a.percent);
    return sorted[0] ?? null;
  }

  private buildStockChartData(entries: StockByOperatorEntry[]): any {
    if (!entries.length) return null;
    // Sort descending by total so visual hierarchy reflects magnitude.
    const sorted = [...entries].sort(
      (a, b) => (b.freshCount + b.longStayCount) - (a.freshCount + a.longStayCount),
    );
    const labels = sorted.map(e => e.lineOperatorCode);
    return {
      labels,
      datasets: [
        {
          label: 'Fresh (< 10 ngày)',
          data: sorted.map(e => e.freshCount),
          backgroundColor: '#2563EB',
          borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 6, bottomRight: 6 },
          borderSkipped: false,
          maxBarThickness: 56,
        },
        {
          label: 'Long-stay (≥ 10 ngày)',
          data: sorted.map(e => e.longStayCount),
          backgroundColor: '#E65100',
          borderRadius: { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 },
          borderSkipped: false,
          maxBarThickness: 56,
        },
      ],
    };
  }

  private buildStackedBarOptions(): any {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            usePointStyle: true,
            boxWidth: 10,
            boxHeight: 10,
            padding: 14,
            font: { size: 11, family: 'system-ui, -apple-system, sans-serif' },
            color: '#555',
          },
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(17, 24, 39, 0.96)',
          titleColor: '#fff',
          titleFont: { weight: 'bold', size: 12 },
          bodyColor: '#E5E7EB',
          bodyFont: { size: 11 },
          padding: 10,
          cornerRadius: 6,
          usePointStyle: true,
          boxPadding: 6,
          callbacks: {
            title: (items: any[]) => `Line Operator: ${items[0]?.label ?? ''}`,
            label: (ctx: any) => ` ${ctx.dataset.label}: ${ctx.parsed.y} container`,
            footer: (items: any[]) => {
              const total = items.reduce((s, i) => s + (i.parsed.y ?? 0), 0);
              return `Tổng: ${total} container`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false, drawBorder: false },
          ticks: { color: '#555', font: { size: 11, weight: '500' } },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.06)', drawBorder: false },
          ticks: { precision: 0, color: '#666', font: { size: 11 }, padding: 6 },
        },
      },
    };
  }

  loadDashboard() {
    this.loading = true;

    forkJoin({
      summary: this.depotService.getDashboard(),
      visits: this.depotService.getContainerVisits(),
      orders: this.depotService.getDeliveryOrders(),
      operators: this.depotService.getLineOperators(),
      yardBlocks: this.depotService.getYardBlocks(),
    }).subscribe({
      next: ({ summary, visits, orders, operators, yardBlocks }) => {
        this.dashboard = this.enrichDashboard(summary, visits, orders, operators, yardBlocks);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  getOccupancyPercent(block: { activeContainers: number; maxCapacity?: number }): number {
    if (!block.maxCapacity) return 0;
    return Math.round((block.activeContainers / block.maxCapacity) * 100);
  }

  isHighOccupancy(block: { activeContainers: number; maxCapacity?: number }): boolean {
    return this.getOccupancyPercent(block) > 90;
  }

  private enrichDashboard(
    summary: DepotDashboard,
    visits: ContainerVisit[],
    orders: DeliveryOrder[],
    operators: LineOperator[],
    yardBlocks: YardBlock[],
  ): DepotDashboard {
    const operatorNameByCode = new Map(
      operators.map(operator => [operator.code, operator.name]),
    );
    const blockByCode = new Map(
      yardBlocks.map(block => [block.code, block]),
    );

    const today = new Date();
    const isSameUtcDay = (value?: string) => {
      if (!value) return false;
      const date = new Date(value);
      return date.getUTCFullYear() === today.getUTCFullYear()
        && date.getUTCMonth() === today.getUTCMonth()
        && date.getUTCDate() === today.getUTCDate();
    };

    const todayGateIn = visits.filter(visit => isSameUtcDay(visit.inboundAt)).length;
    const todayGateOut = visits.filter(visit => isSameUtcDay(visit.outboundAt)).length;

    const physicalBlocks = yardBlocks.filter(block => block.blockType === 'Physical' && !!block.maxCapacity);
    const totalCapacity = physicalBlocks.reduce((sum, block) => sum + (block.maxCapacity ?? 0), 0);
    const totalOccupied = summary.blockOccupancies.reduce((sum, block) => sum + block.activeContainers, 0);
    const yardOccupancyPercent = totalCapacity ? Math.round((totalOccupied / totalCapacity) * 100) : 0;

    // TF-11 — Recent Activity: 10 gần nhất, cắt cửa sổ 24h.
    const dayAgoMs = Date.now() - 24 * 60 * 60 * 1000;
    const recentActivity = visits
      .flatMap(visit => {
        const operatorName = operatorNameByCode.get(visit.lineOperatorCode) ?? visit.lineOperatorCode;
        return [
          {
            time: visit.inboundAt,
            containerNumber: visit.containerNumber,
            action: 'Gate-In',
            blockCode: visit.yardBlockCode,
            operatorName,
          },
          ...(visit.outboundAt ? [{
            time: visit.outboundAt,
            containerNumber: visit.containerNumber,
            action: 'Gate-Out',
            blockCode: visit.yardBlockCode,
            operatorName,
          }] : []),
        ];
      })
      .filter(item => item.time && new Date(item.time).getTime() >= dayAgoMs)
      .sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime())
      .slice(0, 10);

    // TF-11 — Expiring Orders: cửa sổ 3 ngày + severity theo khoảng cách.
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    const oneDayMs = 24 * 60 * 60 * 1000;
    const twoDaysMs = 2 * oneDayMs;
    const nowMs = Date.now();
    const threshold = nowMs + threeDaysMs;
    const expiringSoonOrders = orders
      .filter(order => {
        const expiryMs = new Date(order.orderExpiryDate).getTime();
        return !order.isExpired && order.hasRemainingQuantity && expiryMs <= threshold;
      })
      .sort((left, right) => new Date(left.orderExpiryDate).getTime() - new Date(right.orderExpiryDate).getTime())
      .slice(0, 10)
      .map(order => {
        const remainingMs = new Date(order.orderExpiryDate).getTime() - nowMs;
        let severity: 'danger' | 'warn' | 'info';
        if (remainingMs < oneDayMs) severity = 'danger';
        else if (remainingMs < twoDaysMs) severity = 'warn';
        else severity = 'info';
        return {
          orderNumber: order.orderNumber,
          operatorName: order.lineOperatorName,
          expiryDate: order.orderExpiryDate,
          remainingContainers: order.totalRemainingQuantity,
          severity,
        };
      });

    return {
      ...summary,
      todayGateIn,
      todayGateOut,
      yardOccupancyPercent,
      blockOccupancies: summary.blockOccupancies.map(block => ({
        ...block,
        blockName: blockByCode.get(block.blockCode)?.name,
        maxCapacity: blockByCode.get(block.blockCode)?.maxCapacity,
      })),
      recentActivity,
      expiringSoonOrders,
    };
  }
}

function toInputDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseInputDate(s: string): Date | null {
  if (!s) return null;
  const parts = s.split('-');
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
