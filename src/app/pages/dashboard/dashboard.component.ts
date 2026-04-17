import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { DepotService } from '../../core/services/depot.service';
import { DepotDashboard, ContainerVisit, DeliveryOrder, LineOperator, YardBlock } from '../../core/models/depot.models';

@Component({
  selector: 'depot-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit, OnDestroy {
  dashboard: DepotDashboard | null = null;
  loading = true;
  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private depotService: DepotService) {}

  ngOnInit() {
    this.loadDashboard();
    this.refreshInterval = setInterval(() => this.loadDashboard(), 60000);
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
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
