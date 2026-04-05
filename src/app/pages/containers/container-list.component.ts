import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DepotService } from '../../core/services/depot.service';
import { DepotContainer } from '../../core/models/depot.models';

@Component({
  selector: 'depot-container-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-header">
      <h1>Containers</h1>
      <p>Container master data management</p>
    </div>

    <div class="surface-card p-4 border-round shadow-1">
      <p class="text-color-secondary">Container list will be implemented here with PrimeNG Table.</p>
      <!-- TODO: p-table with search, filter, CRUD -->
    </div>
  `,
})
export class ContainerListComponent implements OnInit {
  containers: DepotContainer[] = [];

  constructor(private depotService: DepotService) {}

  ngOnInit(): void {
    this.depotService.getContainers().subscribe({
      next: (data) => (this.containers = data),
      error: (err) => console.error('Failed to load containers', err),
    });
  }
}
