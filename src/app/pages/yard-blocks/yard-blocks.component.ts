import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DepotService } from '../../core/services/depot.service';
import { YardBlock } from '../../core/models/depot.models';

@Component({
  selector: 'depot-yard-blocks',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-header">
      <h1>Yard Blocks</h1>
      <p>Manage depot yard block layout</p>
    </div>

    <div class="surface-card p-4 border-round shadow-1">
      <p class="text-color-secondary">Yard block list will be implemented here with PrimeNG Table.</p>
      <!-- TODO: p-table with CRUD operations -->
    </div>
  `,
})
export class YardBlocksComponent implements OnInit {
  blocks: YardBlock[] = [];

  constructor(private readonly depotService: DepotService) {}

  ngOnInit(): void {
    this.depotService.getYardBlocks().subscribe({
      next: (data) => (this.blocks = data),
      error: (err) => console.error('Failed to load yard blocks', err),
    });
  }
}
