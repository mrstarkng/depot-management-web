import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subject, Subscription, debounceTime, takeUntil } from 'rxjs';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import {
  YardBlockCategory,
  YardBlockRotation,
  YardMapBlock,
  YardMapContainerSlot,
  YardMapFacility,
  YardMapHeatmapCell,
  YardMapOverview,
  YardMapRealtimeEvent,
  LayoutLockRequestedEvent,
  LayoutSavedEvent,
} from '../../core/models/depot.models';
import { YardMapService, YardMapConnectionState } from '../../core/services/yard-map.service';
import { AuthService } from '../../core/services/auth.service';
import {
  ConfirmDialogComponent,
  SlideOverComponent,
} from '../../core/components';
import { KonvaYardMap } from './konva/konva-yard-map';
import { CATEGORY_COLOR, OverlayMode } from './yard-map.tokens';
import { LayoutEditorStore } from './editor/layout-editor.store';
import { describeYardMapError } from './yard-map.errors';

interface HeatmapCacheEntry {
  cells: YardMapHeatmapCell[];
  fetchedAt: number;
}

@Component({
  selector: 'depot-yard-map',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    ToastModule,
    SlideOverComponent,
    ConfirmDialogComponent,
  ],
  providers: [MessageService],
  templateUrl: './yard-map.component.html',
})
export class YardMapComponent implements OnInit, OnDestroy, AfterViewInit {
  private readonly route = inject(ActivatedRoute);
  private readonly yardMap = inject(YardMapService);
  private readonly messageService = inject(MessageService);
  readonly authService = inject(AuthService);
  readonly editor = inject(LayoutEditorStore);

  @ViewChild('canvasHost') canvasHostRef?: ElementRef<HTMLDivElement>;

  readonly allCategories = Object.values(YardBlockCategory);
  readonly categoryColor = CATEGORY_COLOR;

  // ── state signals ──
  readonly overview = signal<YardMapOverview | null>(null);
  readonly selectedBlockCode = signal<string>('');
  readonly blockDetailSlots = signal<YardMapContainerSlot[]>([]);
  readonly drilldownOpen = signal(false);
  readonly selectedSlot = signal<YardMapContainerSlot | null>(null);
  readonly overlayMode = signal<OverlayMode>('off');
  readonly activeCategories = signal<Set<YardBlockCategory>>(new Set(Object.values(YardBlockCategory)));
  readonly searchInput = signal<string>('');
  readonly connectionState = signal<YardMapConnectionState>('disconnected');
  readonly loading = signal(true);
  readonly error = signal('');

  readonly selectedBlock = computed<YardMapBlock | null>(() => {
    const code = this.selectedBlockCode();
    if (!code) return null;
    return this.overview()?.blocks.find(b => b.blockCode === code) ?? null;
  });

  readonly rotationOptions: YardBlockRotation[] = [0, 90, 180, 270];

  inspectorDraft = {
    category: YardBlockCategory.Standard as YardBlockCategory,
    rotation: 0 as YardBlockRotation,
    canvasWidth: 1,
    canvasHeight: 1,
    colorOverride: '' as string | null,
  };

  // ── approval modal ──
  readonly approvalOpen = signal(false);
  readonly approvalRequest = signal<LayoutLockRequestedEvent | null>(null);

  // ── revoke confirm ──
  readonly revokeConfirmOpen = signal(false);

  // ── heatmap cache ──
  private readonly heatmapCache = new Map<OverlayMode, HeatmapCacheEntry>();

  // ── role helpers ──
  readonly canEditLayout = computed(() => this.authService.isManager() || this.authService.hasRole('YardPlanner'));
  readonly readOnlyMode = computed(() => !this.canEditLayout());
  readonly canGrantRevoke = computed(() => this.authService.isManager());
  readonly canRelocate = computed(() => this.authService.canManageYard());

  readonly connectionBadgeStatus = computed(() => {
    switch (this.connectionState()) {
      case 'connected': return 'Active';
      case 'reconnecting': return 'Pending';
      case 'connecting': return 'Pending';
      default: return 'Inactive';
    }
  });

  readonly connectionLabel = computed(() => {
    switch (this.connectionState()) {
      case 'connected': return 'Đã kết nối';
      case 'reconnecting': return 'Đang kết nối lại…';
      case 'connecting': return 'Đang kết nối…';
      default: return 'Mất kết nối';
    }
  });

  readonly lockBanner = computed(() => {
    const lock = this.editor.lock();
    if (!lock || !lock.isActive) return { text: 'Layout unlocked', tone: 'info' as const };
    if (this.editor.isHolder()) return { text: `You hold the layout lock (expires ${fmtTime(lock.expiresAt)})`, tone: 'success' as const };
    return { text: `Layout locked by ${lock.holderFullName ?? lock.holderUserName ?? 'another user'}`, tone: 'warn' as const };
  });

  readonly filteredBlocks = computed<YardMapBlock[]>(() => {
    const blocks = this.overview()?.blocks ?? [];
    const active = this.activeCategories();
    return blocks.filter(b => active.has(b.category));
  });

  readonly dimmedBlockCodes = computed<string[]>(() => {
    const blocks = this.overview()?.blocks ?? [];
    const active = this.activeCategories();
    return blocks.filter(b => !active.has(b.category)).map(b => b.blockCode);
  });

  private renderer: KonvaYardMap | null = null;
  private readonly destroyed$ = new Subject<void>();
  private readonly searchDebounce$ = new Subject<string>();
  private eventsSub?: Subscription;
  private stateSub?: Subscription;
  private editorErrSub?: Subscription;

  constructor() {
    // Re-render when signals change
    effect(() => {
      const r = this.renderer;
      if (!r) return;
      r.setBlocks(this.overview()?.blocks ?? []);
      r.setFacilities(this.overview()?.facilities ?? []);
      r.setDimmedBlocks(this.dimmedBlockCodes());
      r.setSelection(this.selectedBlockCode());
    });

    effect(() => {
      const r = this.renderer;
      if (!r) return;
      r.setEditable(this.editor.state() === 'holding');
    });

    effect(() => {
      const r = this.renderer;
      if (!r) return;
      const mode = this.overlayMode();
      const cells = this.heatmapCache.get(mode)?.cells ?? [];
      r.setOverlay(mode, cells);
    });
  }

  async ngOnInit() {
    this.route.queryParamMap.pipe(takeUntil(this.destroyed$)).subscribe(params => {
      const focus = (params.get('focus') || '').toUpperCase();
      if (focus) {
        this.selectedBlockCode.set(focus);
        this.loadBlockDetail(focus);
      }
    });

    this.searchDebounce$.pipe(debounceTime(250), takeUntil(this.destroyed$)).subscribe(term => this.applySearch(term));

    this.stateSub = this.yardMap.connectionState$.subscribe(state => {
      const prev = this.connectionState();
      this.connectionState.set(state);
      if (state === 'connected') {
        // Always reseed lock state on (re)connect
        this.editor.refreshLockStatus();
        // BR-FE-RT-02: after a reconnect, refresh snapshot to catch missed events
        if (prev === 'reconnecting' || prev === 'disconnected') {
          this.loadOverview();
          this.messageService.add({
            severity: 'success', summary: 'Đã kết nối lại',
            detail: 'Tải lại dữ liệu mới nhất từ máy chủ.', life: 2500,
          });
        }
      }
    });

    this.eventsSub = this.yardMap.events$.subscribe(event => this.handleRealtime(event));

    this.editorErrSub = this.editor.errors$.subscribe(({ action, error }) => {
      if (action === 'heartbeatLost') {
        this.messageService.add({
          severity: 'warn',
          summary: 'Mất kết nối lock',
          detail: 'Heartbeat thất bại > 120s — layout editor chuyển sang chế độ read-only. Vui lòng kiểm tra kết nối và xin lock lại nếu cần.',
          life: 6000,
        });
        return;
      }
      if (action === 'heartbeat') {
        // Suppress transient heartbeat errors; the store tracks retries until heartbeatLost fires.
        return;
      }
      this.showError(action, error);
    });

    await this.loadOverview();
    this.editor.refreshLockStatus();

    try {
      await this.yardMap.connect();
    } catch (err) {
      this.showError('Live', err);
    }
  }

  ngAfterViewInit() {
    if (!this.canvasHostRef) return;
    this.renderer = new KonvaYardMap();
    this.renderer.mount(this.canvasHostRef.nativeElement);

    this.renderer.blockClick$.pipe(takeUntil(this.destroyed$)).subscribe(ev => {
      this.selectBlock(ev.blockCode);
    });

    this.renderer.blockDragEnd$.pipe(takeUntil(this.destroyed$)).subscribe(ev => {
      const snapshot = this.overview();
      if (!snapshot) return;
      const block = snapshot.blocks.find(b => b.blockCode === ev.blockCode);
      if (!block) return;
      if (block.isCore) return; // DEC-010 — core block vị trí không đổi được
      block.canvasX = ev.canvasX;
      block.canvasY = ev.canvasY;
      this.overview.set({ ...snapshot });
      this.editor.trackDirty(block, { canvasX: ev.canvasX, canvasY: ev.canvasY });
    });

    // Paint first frame + sync editable if lock already held
    this.renderer.setBlocks(this.overview()?.blocks ?? []);
    this.renderer.setFacilities(this.overview()?.facilities ?? []);
    this.renderer.setEditable(this.editor.state() === 'holding');
  }

  async ngOnDestroy() {
    this.destroyed$.next();
    this.destroyed$.complete();
    this.eventsSub?.unsubscribe();
    this.stateSub?.unsubscribe();
    this.editorErrSub?.unsubscribe();
    this.editor.stopHeartbeat();
    this.renderer?.destroy();
    this.renderer = null;
    await this.yardMap.disconnect();
  }

  // ── page actions ──
  async loadOverview() {
    this.loading.set(true);
    this.error.set('');
    this.yardMap.getOverview().subscribe({
      next: snapshot => {
        this.overview.set(snapshot);
        this.loading.set(false);
        if (this.renderer) {
          this.renderer.setBlocks(snapshot.blocks);
          this.renderer.setFacilities(snapshot.facilities ?? []);
          this.renderer.fitAll();
        }
        if (this.selectedBlockCode()) {
          this.renderer?.panTo(this.selectedBlockCode());
        }
      },
      error: err => {
        this.loading.set(false);
        this.showError('Load overview', err);
      },
    });
  }

  loadBlockDetail(blockCode: string) {
    if (!blockCode) return;
    this.yardMap.getBlockDetail(blockCode).subscribe({
      next: detail => {
        this.blockDetailSlots.set(detail.slots);
        this.selectedBlockCode.set(detail.block.blockCode);
        this.drilldownOpen.set(true);
      },
      error: err => this.showError('Block detail', err),
    });
  }

  selectBlock(blockCode: string) {
    this.selectedBlockCode.set(blockCode);
    this.renderer?.setSelection(blockCode);
    this.loadBlockDetail(blockCode);
    const block = this.overview()?.blocks.find(b => b.blockCode === blockCode);
    if (block) {
      this.inspectorDraft = {
        category: block.category,
        rotation: block.rotation,
        canvasWidth: block.canvasWidth,
        canvasHeight: block.canvasHeight,
        colorOverride: block.colorOverride ?? '',
      };
    }
  }

  applyInspector() {
    const block = this.selectedBlock();
    if (!block) return;
    if (!this.editor.isHolder()) return;

    // DEC-010: Core block chỉ được đổi Category + ColorOverride.
    const normalizedColor = this.inspectorDraft.colorOverride?.trim()
      ? this.inspectorDraft.colorOverride.trim()
      : null;
    const patch: Partial<YardMapBlock> = block.isCore
      ? {
          category: this.inspectorDraft.category,
          colorOverride: normalizedColor,
        }
      : {
          category: this.inspectorDraft.category,
          rotation: this.inspectorDraft.rotation,
          canvasWidth: Math.max(1, Number(this.inspectorDraft.canvasWidth) || 1),
          canvasHeight: Math.max(1, Number(this.inspectorDraft.canvasHeight) || 1),
          colorOverride: normalizedColor,
        };

    // Mutate overview snapshot so Konva re-renders
    Object.assign(block, patch);
    const snapshot = this.overview();
    if (snapshot) this.overview.set({ ...snapshot });

    this.editor.trackDirty(block, patch as any);
  }

  selectSlot(slot: YardMapContainerSlot) {
    this.selectedSlot.set(slot);
  }

  closeDrilldown() {
    this.drilldownOpen.set(false);
    this.selectedSlot.set(null);
  }

  toggleOverlay(mode: OverlayMode) {
    this.overlayMode.set(mode);
    if (mode === 'off') {
      this.renderer?.setOverlay('off', []);
      return;
    }
    const cached = this.heatmapCache.get(mode);
    const fresh = cached && Date.now() - cached.fetchedAt < 60_000;
    if (fresh && cached) {
      this.renderer?.setOverlay(mode, cached.cells);
      return;
    }
    const fetch$ = mode === 'occupancy' ? this.yardMap.getHeatmap() : this.yardMap.getDwellHeatmap();
    fetch$.subscribe({
      next: cells => {
        this.heatmapCache.set(mode, { cells, fetchedAt: Date.now() });
        this.renderer?.setOverlay(mode, cells);
      },
      error: err => this.showError('Heatmap', err),
    });
  }

  toggleCategory(category: YardBlockCategory) {
    const active = new Set(this.activeCategories());
    if (active.has(category)) active.delete(category);
    else active.add(category);
    this.activeCategories.set(active);
  }

  resetFilters() {
    this.searchInput.set('');
    this.searchDebounce$.next('');
    this.overlayMode.set('off');
    this.activeCategories.set(new Set(Object.values(YardBlockCategory)));
    this.renderer?.setOverlay('off', []);
    this.renderer?.fitAll();
  }

  onSearchInput(term: string) {
    this.searchInput.set(term);
    this.searchDebounce$.next(term);
  }

  private applySearch(term: string) {
    if (!term) return;
    const target = term.trim().toUpperCase();
    const snapshot = this.overview();
    if (!snapshot) return;
    const matchBlock = snapshot.blocks.find(b => b.blockCode.toUpperCase() === target);
    if (matchBlock) {
      this.selectBlock(matchBlock.blockCode);
      this.renderer?.panTo(matchBlock.blockCode);
      return;
    }
    // fallback: treat as container search (we don't have full slot index on overview, so just use drill-in data)
    const slot = this.blockDetailSlots().find(s => s.containerNumber?.toUpperCase().includes(target));
    if (slot) {
      this.selectedSlot.set(slot);
      this.drilldownOpen.set(true);
    }
  }

  fitAll() { this.renderer?.fitAll(); }
  zoomIn() { this.renderer?.zoomBy(1.15); }
  zoomOut() { this.renderer?.zoomBy(1 / 1.15); }
  resetView() { this.renderer?.reset(); }

  // ── editor actions ──
  requestEdit() {
    if (this.authService.isManager()) {
      this.editor.grantSelf(15);
    } else {
      this.editor.requestLock();
      this.messageService.add({ severity: 'info', summary: 'Request sent', detail: 'Manager will be notified.', life: 3000 });
    }
  }

  saveLayout() {
    this.editor.saveNow();
  }

  releaseLock() {
    this.editor.release();
  }

  openRevokeConfirm() { this.revokeConfirmOpen.set(true); }
  cancelRevoke() { this.revokeConfirmOpen.set(false); }
  confirmRevoke() {
    this.revokeConfirmOpen.set(false);
    this.editor.revoke('Revoked by Manager');
  }

  // ── realtime handler ──
  private handleRealtime(event: YardMapRealtimeEvent) {
    switch (event.eventType) {
      case 'ContainerGateIn':
      case 'ContainerMoved':
      case 'ContainerGateOut':
        this.patchSlotFromEvent(event);
        break;
      case 'LayoutSaved': {
        const payload = event as unknown as LayoutSavedEvent;
        const localRev = this.overview()?.revision;
        if (!localRev || payload.revision !== localRev) {
          this.loadOverview();
          this.messageService.add({
            severity: 'info',
            summary: 'Layout refreshed',
            detail: `${payload.savedByUserName ?? 'Another user'} saved layout changes.`,
            life: 3000,
          });
        }
        break;
      }
      case 'LayoutLockAcquired':
      case 'LayoutLockReleased':
      case 'LayoutLockExpired':
        this.editor.refreshLockStatus();
        break;
      case 'LayoutLockRequested': {
        const payload = event as unknown as LayoutLockRequestedEvent;
        if (this.authService.isManager()) {
          this.approvalRequest.set(payload);
          this.approvalOpen.set(true);
        }
        break;
      }
      default:
        break;
    }
  }

  private patchSlotFromEvent(event: YardMapRealtimeEvent) {
    if (!event.blockCode) return;
    if (event.blockCode !== this.selectedBlockCode()) return;
    // Refetch the drill-in block to keep slot list accurate without much complexity
    this.yardMap.getBlockDetail(event.blockCode).subscribe({
      next: detail => this.blockDetailSlots.set(detail.slots),
      error: () => void 0,
    });
  }

  // ── manager approval ──
  grantApproval() {
    const req = this.approvalRequest();
    if (!req) return;
    this.editor.grantTo(req.requesterUserId, 15, `Granted by Manager for ${req.requesterUserName ?? 'YardPlanner'}`);
    this.approvalOpen.set(false);
    this.approvalRequest.set(null);
  }

  dismissApproval() {
    this.approvalOpen.set(false);
    this.approvalRequest.set(null);
  }

  // ── helpers ──
  isCategoryActive(category: YardBlockCategory): boolean {
    return this.activeCategories().has(category);
  }

  categoryColorOf(category: YardBlockCategory): string {
    return this.categoryColor[category];
  }

  private showError(action: string, err: unknown) {
    const desc = describeYardMapError(err, action);
    this.messageService.add({
      severity: desc.severity,
      summary: desc.summary,
      detail: desc.detail,
      life: desc.severity === 'error' ? 5000 : 3500,
    });
    if (desc.action === 'refreshLock') {
      this.editor.refreshLockStatus();
    } else if (desc.action === 'reload') {
      this.loadOverview();
    } else if (desc.action === 'login') {
      // leave to auth interceptor to redirect
    }
  }
}

function fmtTime(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
