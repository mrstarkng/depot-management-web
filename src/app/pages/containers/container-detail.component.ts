import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { DepotService } from '../../core/services/depot.service';
import { DepotContainer } from '../../core/models/depot.models';

@Component({
  selector: 'depot-container-detail',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-header">
      <h1>Container Detail</h1>
      <p>{{ containerNumber }}</p>
    </div>

    <div class="surface-card p-4 border-round shadow-1">
      <p class="text-color-secondary">Container detail view will be implemented here.</p>
      <!-- TODO: container info, visit history, movement timeline -->
    </div>
  `,
})
export class ContainerDetailComponent implements OnInit {
  containerNumber = '';
  container?: DepotContainer;

  constructor(
    private route: ActivatedRoute,
    private depotService: DepotService,
  ) {}

  ngOnInit(): void {
    this.containerNumber = this.route.snapshot.paramMap.get('containerNumber') ?? '';
    if (this.containerNumber) {
      this.depotService.getContainerByNumber(this.containerNumber).subscribe({
        next: (data) => (this.container = data),
        error: (err) => console.error('Failed to load container', err),
      });
    }
  }
}
