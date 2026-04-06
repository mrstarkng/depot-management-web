import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { DepotService } from '../../core/services/depot.service';
import { DeliveryOrder } from '../../core/models/depot.models';

@Component({
  selector: 'depot-order-detail',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-header">
      <h1>Delivery Order Detail</h1>
      <p>{{ orderNumber }}</p>
    </div>

    <div class="surface-card p-4 border-round shadow-1">
      <p class="text-color-secondary">Order detail view will be implemented here.</p>
      <!-- TODO: order info, line items table, linked container visits -->
    </div>
  `,
})
export class OrderDetailComponent implements OnInit {
  orderNumber = '';
  order?: DeliveryOrder;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly depotService: DepotService,
  ) {}

  ngOnInit(): void {
    this.orderNumber = this.route.snapshot.paramMap.get('orderNumber') ?? '';
  }
}
