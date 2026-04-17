import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { DepotService } from '../../core/services/depot.service';
import { AuthService } from '../../core/services/auth.service';
import { DeliveryOrder, EligibleContainer, ContainerVisit } from '../../core/models/depot.models';
import { StatusBadgeComponent, SlideOverComponent } from '../../core/components';

@Component({
  selector: 'depot-order-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ToastModule, DatePipe, StatusBadgeComponent, SlideOverComponent],
  providers: [MessageService],
  templateUrl: './order-detail.component.html',
})
export class OrderDetailComponent implements OnInit {
  orderNumber = '';
  order: DeliveryOrder | null = null;
  eligibleContainers: EligibleContainer[] = [];
  releaseHistory: ContainerVisit[] = [];

  // Outbound slide-over
  outboundSlideOpen = false;
  outbounding = false;
  outboundContainerNumber = '';
  outboundVehicle = '';

  constructor(
    private route: ActivatedRoute,
    private depotService: DepotService,
    private messageService: MessageService,
    public authService: AuthService,
  ) {}

  ngOnInit() {
    this.orderNumber = this.route.snapshot.paramMap.get('orderNumber') ?? '';
    if (this.orderNumber) {
      this.loadData(this.orderNumber);
    }
  }

  loadData(orderNumber: string) {
    this.depotService.getDeliveryOrder(orderNumber).subscribe(data => this.order = data);
    this.depotService.getEligibleContainers(orderNumber).subscribe(data => this.eligibleContainers = data);
    this.depotService.getContainerVisits({ status: 'Released' }).subscribe(data => {
      this.releaseHistory = data.filter(v => v.deliveryOrderNumber === orderNumber);
    });
  }

  get isEditable(): boolean {
    return !!this.order && !this.order.isExpired && !this.order.isFulfilled;
  }

  getOrderStatus(): string {
    if (!this.order) return '';
    if (this.order.isExpired) return 'Expired';
    if (this.order.isFulfilled) return 'Fulfilled';
    return 'Open';
  }

  getOrderBadgeStatus(): string {
    if (!this.order) return 'Active';
    if (this.order.isExpired) return 'Expired';
    if (this.order.isFulfilled) return 'Fulfilled';
    return 'Active';
  }

  get progressPercent(): number {
    if (!this.order || this.order.totalRequestedQuantity === 0) return 0;
    return (this.order.totalReleasedQuantity / this.order.totalRequestedQuantity) * 100;
  }

  openOutbound(containerNumber: string) {
    if (!this.authService.canGateInOut()) return;
    this.outboundContainerNumber = containerNumber;
    this.outboundVehicle = '';
    this.outboundSlideOpen = true;
  }

  doOutbound() {
    if (!this.authService.canGateInOut()) return;
    if (!this.order) return;
    this.outbounding = true;
    this.depotService.outboundContainer({
      containerNumber: this.outboundContainerNumber,
      orderNumber: this.order.orderNumber,
      outboundVehicle: this.outboundVehicle,
    }).subscribe({
      next: () => {
        this.outbounding = false;
        this.outboundSlideOpen = false;
        this.messageService.add({ severity: 'success', summary: 'Released', detail: `${this.outboundContainerNumber} released`, life: 3000 });
        this.loadData(this.order!.orderNumber);
      },
      error: (err) => {
        this.outbounding = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.Message || 'Outbound failed', life: 5000 });
      },
    });
  }
}
