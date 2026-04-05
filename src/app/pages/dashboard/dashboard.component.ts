import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'depot-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-header">
      <h1>Dashboard</h1>
      <p>Depot container management overview</p>
    </div>

    <div class="grid">
      <div class="col-12 md:col-6 lg:col-3">
        <div class="surface-card p-4 border-round shadow-1">
          <div class="text-color-secondary mb-2">Containers In Depot</div>
          <div class="text-3xl font-bold">—</div>
        </div>
      </div>
      <div class="col-12 md:col-6 lg:col-3">
        <div class="surface-card p-4 border-round shadow-1">
          <div class="text-color-secondary mb-2">Yard Blocks</div>
          <div class="text-3xl font-bold">—</div>
        </div>
      </div>
      <div class="col-12 md:col-6 lg:col-3">
        <div class="surface-card p-4 border-round shadow-1">
          <div class="text-color-secondary mb-2">Active Delivery Orders</div>
          <div class="text-3xl font-bold">—</div>
        </div>
      </div>
      <div class="col-12 md:col-6 lg:col-3">
        <div class="surface-card p-4 border-round shadow-1">
          <div class="text-color-secondary mb-2">Today's Gate Activity</div>
          <div class="text-3xl font-bold">—</div>
        </div>
      </div>
    </div>
  `,
})
export class DashboardComponent {}
