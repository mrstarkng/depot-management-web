import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DepotService } from '../../core/services/depot.service';
import { DeliveryOrder } from '../../core/models/depot.models';

@Component({
  selector: 'depot-order-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-header">
      <h1>Delivery Orders</h1>
      <p>Manage container release orders</p>
    </div>

    <div class="surface-card p-4 border-round shadow-1">
      <p class="text-color-secondary">Delivery order list will be implemented here with PrimeNG Table.</p>
      <!-- TODO: p-table with CRUD, line items dialog -->
    </div>
  `,
})
export class OrderListComponent implements OnInit {
  orders: DeliveryOrder[] = [];

  constructor(private depotService: DepotService) {}

  ngOnInit(): void {
    this.depotService.getDeliveryOrders().subscribe({
      next: (data) => (this.orders = data),
      error: (err) => console.error('Failed to load delivery orders', err),
    });
  }
}
