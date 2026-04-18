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

  private buildThroughputChartData(entries: ThroughputEntry[], mode: ThroughputMode): any {
    if (!entries.length) return null;
    const dates = Array.from(new Set(entries.map(e => e.date))).sort();
    const operators = Array.from(new Set(entries.map(e => e.lineOperatorCode))).sort();

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
          backgroundColor: color + '22',
          tension: 0.3,
          borderDash: mode === 'both' ? undefined : undefined,
        });
      }
      if (mode === 'both' || mode === 'outbound') {
        datasets.push({
          label: `${op} · Outbound`,
          data: dates.map(d => lookup.get(d)?.outboundCount ?? 0),
          borderColor: color,
          backgroundColor: color + '11',
          borderDash: [4, 4],
          tension: 0.3,
        });
      }
    });

    return { labels: dates, datasets };
  }

  private buildLineChartOptions(): any {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } },
        tooltip: {
          callbacks: {
            label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.y} (${ctx.label})`,
          },
        },
      },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } },
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

  private buildStockChartData(entries: StockByOperatorEntry[]): any {
    if (!entries.length) return null;
    const labels = entries.map(e => e.lineOperatorCode);
    return {
      labels,
      datasets: [
        {
          label: '< 10 ngày',
          data: entries.map(e => e.freshCount),
          backgroundColor: '#2563EB',
        },
        {
          label: '≥ 10 ngày',
          data: entries.map(e => e.longStayCount),
          backgroundColor: '#E65100',
        },
      ],
    };
  }

  private buildStackedBarOptions(): any {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } },
        tooltip: {
          callbacks: {
            label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.y}`,
            title: (items: any[]) => `Hãng ${items[0]?.label ?? ''}`,
          },
        },
      },
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } },
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
      .sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime())
      .slice(0, 20);

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const expiringSoonOrders = orders
      .filter(order => {
        const expiry = new Date(order.orderExpiryDate);
        return !order.isExpired && order.hasRemainingQuantity && expiry <= nextWeek;
      })
      .sort((left, right) => new Date(left.orderExpiryDate).getTime() - new Date(right.orderExpiryDate).getTime())
      .slice(0, 10)
      .map(order => ({
        orderNumber: order.orderNumber,
        operatorName: order.lineOperatorName,
        expiryDate: order.orderExpiryDate,
        remainingContainers: order.totalRemainingQuantity,
      }));

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
