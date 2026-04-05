import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'depot-inbound',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-header">
      <h1>Gate In / Out</h1>
      <p>Container inbound and outbound operations</p>
    </div>

    <div class="grid">
      <div class="col-12 lg:col-6">
        <div class="surface-card p-4 border-round shadow-1">
          <h3>Gate In</h3>
          <p class="text-color-secondary">Gate-in form will be implemented here.</p>
          <!-- TODO: gate-in form with container lookup, yard block assignment -->
        </div>
      </div>
      <div class="col-12 lg:col-6">
        <div class="surface-card p-4 border-round shadow-1">
          <h3>Gate Out</h3>
          <p class="text-color-secondary">Gate-out form will be implemented here.</p>
          <!-- TODO: gate-out form with delivery order linking -->
        </div>
      </div>
    </div>

    <div class="surface-card p-4 border-round shadow-1 mt-4">
      <h3>Current Visits In Depot</h3>
      <p class="text-color-secondary">Active visit list will be implemented here.</p>
      <!-- TODO: p-table of in-depot visits with relocate action -->
    </div>
  `,
})
export class InboundComponent {}
