import { Component, OnDestroy, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  YardMapOverview,
  YardMapBlock,
  YardMapContainerSlot,
  YardMapHeatmapCell,
  YardMapRealtimeEvent,
} from '../../core/models/depot.models';
import { YardMapService } from '../../core/services/yard-map.service';
import { AuthService } from '../../core/services/auth.service';

type HeatmapMode = 'off' | 'occupancy' | 'dwell';

@Component({
  selector: 'depot-yard-map',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './yard-map.component.html',
})
export class YardMapComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly yardMapService = inject(YardMapService);
  readonly authService = inject(AuthService);

  loading = signal(true);
  connected = signal(false);
  error = signal('');

  overview = signal<YardMapOverview | null>(null);
  selectedBlockCode = signal<string>('');
  heatmapMode = signal<HeatmapMode>('off');
  heatmapCells = signal<YardMapHeatmapCell[]>([]);
  lastEvent = signal<YardMapRealtimeEvent | null>(null);

  searchContainer = '';
  statusFilter = 'All';

  private querySub?: Subscription;
  private eventSub?: Subscription;

  readonly blocks = computed<YardMapBlock[]>(() => this.overview()?.blocks ?? []);
  readonly slots = computed<YardMapContainerSlot[]>(() => this.overview()?.slots ?? []);

  readonly filteredSlots = computed<YardMapContainerSlot[]>(() => {
    const q = this.searchContainer.trim().toUpperCase();
    const selected = this.selectedBlockCode();

    return this.slots().filter(slot => {
      const matchBlock = !selected || slot.blockCode === selected;
      const matchSearch = !q || slot.containerNumber.toUpperCase().includes(q);
      return matchBlock && matchSearch;
    });
  });

  readonly readOnlyMode = computed(() => this.authService.canGateInOut() && !this.authService.canManageYard());

  async ngOnInit() {
    this.querySub = this.route.queryParamMap.subscribe(params => {
      const focus = (params.get('focus') || '').toUpperCase();
      this.selectedBlockCode.set(focus);
      if (focus) {
        this.loadBlockDetail(focus);
      }
    });

    await this.loadOverview();

    try {
      await this.yardMapService.connect();
      this.connected.set(true);
    } catch {
      this.connected.set(false);
    }

    this.eventSub = this.yardMapService.events$.subscribe(event => {
      this.lastEvent.set(event);
    });
  }

  async ngOnDestroy() {
    this.querySub?.unsubscribe();
    this.eventSub?.unsubscribe();
    await this.yardMapService.disconnect();
    this.connected.set(false);
  }

  async loadOverview() {
    this.loading.set(true);
    this.error.set('');

    this.yardMapService.getOverview().subscribe({
      next: (data) => {
        this.overview.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Failed to load yard map overview.');
      },
    });
  }

  loadBlockDetail(blockCode: string) {
    if (!blockCode) return;

    this.yardMapService.getBlockDetail(blockCode).subscribe({
      next: (detail) => {
        const current = this.overview();
        if (!current) {
          this.overview.set({ blocks: [detail.block], slots: detail.slots });
          return;
        }

        const updatedBlocks = current.blocks.map(b => b.blockCode === detail.block.blockCode ? detail.block : b);
        const otherSlots = current.slots.filter(s => s.blockCode !== detail.block.blockCode);
        this.overview.set({ blocks: updatedBlocks, slots: [...otherSlots, ...detail.slots] });
      },
      error: () => {
        this.error.set(`Failed to load block detail for ${blockCode}.`);
      },
    });
  }

  toggleHeatmap(mode: HeatmapMode) {
    this.heatmapMode.set(mode);
    this.heatmapCells.set([]);

    if (mode === 'off') return;

    const load$ = mode === 'occupancy'
      ? this.yardMapService.getHeatmap()
      : this.yardMapService.getDwellHeatmap();

    load$.subscribe({
      next: (cells) => this.heatmapCells.set(cells),
      error: () => this.error.set('Failed to load heatmap data.'),
    });
  }

  selectBlock(blockCode: string) {
    this.selectedBlockCode.set(this.selectedBlockCode() === blockCode ? '' : blockCode);
    if (this.selectedBlockCode()) {
      this.loadBlockDetail(this.selectedBlockCode());
    }
  }

  clearFilters() {
    this.searchContainer = '';
    this.statusFilter = 'All';
    this.selectedBlockCode.set('');
  }
}
