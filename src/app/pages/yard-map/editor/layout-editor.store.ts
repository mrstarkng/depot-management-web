import { Injectable, computed, inject, signal } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import {
  LayoutBlockUpdate,
  YardBlockCategory,
  YardBlockRotation,
  YardLayoutLockDto,
  YardMapBlock,
  YardMapRealtimeEvent,
} from '../../../core/models/depot.models';
import { YardMapService } from '../../../core/services/yard-map.service';
import { AuthService } from '../../../core/services/auth.service';

export type EditorState = 'viewing' | 'requesting' | 'holding' | 'savingLocked' | 'readOnlyLocked';

interface DirtyBlockPatch {
  yardBlockId: number;
  canvasX: number;
  canvasY: number;
  canvasWidth: number;
  canvasHeight: number;
  rotation: YardBlockRotation;
  category: YardBlockCategory;
  colorOverride?: string | null;
  rowVersion?: string | null;
}

@Injectable({ providedIn: 'root' })
export class LayoutEditorStore {
  private readonly yardMap = inject(YardMapService);
  private readonly auth = inject(AuthService);

  readonly state = signal<EditorState>('viewing');
  readonly lock = signal<YardLayoutLockDto | null>(null);
  readonly pendingRequest = signal(false);
  readonly dirtyBlocks = signal<Record<number, DirtyBlockPatch>>({});
  readonly saving = signal(false);

  readonly isHolder = computed(() => {
    const lock = this.lock();
    const userId = this.auth.currentUser()?.id;
    return !!(lock && lock.isActive && userId && lock.holderUserId === userId);
  });

  readonly hasDirty = computed(() => Object.keys(this.dirtyBlocks()).length > 0);

  readonly canRevoke = computed(() => {
    const lock = this.lock();
    return !!(lock && lock.isActive && this.auth.isManager() && !this.isHolder());
  });

  readonly canRequest = computed(() => {
    return !this.lock()?.isActive && this.auth.hasRole('YardPlanner') && !this.auth.isManager();
  });

  readonly canGrantSelf = computed(() => {
    return !this.lock()?.isActive && this.auth.isManager();
  });

  private heartbeatSub: Subscription | null = null;
  readonly errors$ = new Subject<{ action: string; error: any }>();

  ingestEvent(event: YardMapRealtimeEvent, lockPayload?: YardLayoutLockDto): void {
    switch (event.eventType) {
      case 'LayoutLockAcquired':
      case 'LayoutLockReleased':
      case 'LayoutLockExpired':
        this.refreshLockStatus();
        break;
      case 'LayoutLockRequested':
        // consumed by component-level toast; store does not change state
        break;
      default:
        break;
    }
  }

  refreshLockStatus(): void {
    this.yardMap.getLockStatus().subscribe({
      next: lock => this.applyLock(lock),
      error: err => this.errors$.next({ action: 'getLockStatus', error: err }),
    });
  }

  requestLock(reason?: string): void {
    this.pendingRequest.set(true);
    this.state.set('requesting');
    this.yardMap.requestLock({ reason }).subscribe({
      next: () => {
        this.pendingRequest.set(false);
      },
      error: err => {
        this.pendingRequest.set(false);
        this.state.set('viewing');
        this.errors$.next({ action: 'requestLock', error: err });
      },
    });
  }

  grantSelf(ttlMinutes = 15): void {
    const userId = this.auth.currentUser()?.id;
    if (!userId) return;
    this.yardMap.grantLock({ userId, ttlMinutes, reason: 'Self-grant' }).subscribe({
      next: lock => this.applyLock(lock),
      error: err => this.errors$.next({ action: 'grantSelf', error: err }),
    });
  }

  grantTo(userId: string, ttlMinutes = 15, reason?: string): void {
    this.yardMap.grantLock({ userId, ttlMinutes, reason }).subscribe({
      next: lock => this.applyLock(lock),
      error: err => this.errors$.next({ action: 'grantTo', error: err }),
    });
  }

  release(): void {
    this.yardMap.releaseLock().subscribe({
      next: () => {
        this.applyLock(null);
      },
      error: err => this.errors$.next({ action: 'release', error: err }),
    });
  }

  revoke(reason?: string): void {
    this.yardMap.revokeLock(reason).subscribe({
      next: () => this.applyLock(null),
      error: err => this.errors$.next({ action: 'revoke', error: err }),
    });
  }

  trackDirty(block: YardMapBlock, patch: Partial<DirtyBlockPatch>): void {
    if (!this.isHolder()) return;
    const id = (block as any).id ?? (block as any).yardBlockId;
    if (id == null) return;
    const current = this.dirtyBlocks();
    const baseline: DirtyBlockPatch = {
      yardBlockId: id,
      canvasX: block.canvasX,
      canvasY: block.canvasY,
      canvasWidth: block.canvasWidth,
      canvasHeight: block.canvasHeight,
      rotation: block.rotation,
      category: block.category,
      colorOverride: block.colorOverride ?? null,
      rowVersion: block.rowVersion ?? null,
    };
    const merged: DirtyBlockPatch = {
      ...baseline,
      ...(current[id] ?? {}),
      ...patch,
      yardBlockId: id,
    };
    this.dirtyBlocks.set({ ...current, [id]: merged });
  }

  clearDirty(): void {
    this.dirtyBlocks.set({});
  }

  saveNow(): void {
    if (!this.isHolder() || !this.hasDirty()) return;
    const blocks: LayoutBlockUpdate[] = Object.values(this.dirtyBlocks());
    this.saving.set(true);
    this.state.set('savingLocked');
    this.yardMap.saveLayout({ blocks }).subscribe({
      next: () => {
        this.saving.set(false);
        this.state.set('holding');
        this.clearDirty();
      },
      error: err => {
        this.saving.set(false);
        this.state.set('holding');
        this.errors$.next({ action: 'saveLayout', error: err });
      },
    });
  }

  startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatSub = this.yardMap.heartbeat$().subscribe({
      next: lock => this.applyLock(lock),
      error: err => {
        this.errors$.next({ action: 'heartbeat', error: err });
        this.stopHeartbeat();
        this.refreshLockStatus();
      },
    });
  }

  stopHeartbeat(): void {
    this.heartbeatSub?.unsubscribe();
    this.heartbeatSub = null;
  }

  private applyLock(lock: YardLayoutLockDto | null): void {
    this.lock.set(lock);

    const userId = this.auth.currentUser()?.id;
    if (!lock || !lock.isActive) {
      this.state.set('viewing');
      this.stopHeartbeat();
      return;
    }

    if (userId && lock.holderUserId === userId) {
      this.state.set('holding');
      this.startHeartbeat();
    } else {
      this.state.set('readOnlyLocked');
      this.stopHeartbeat();
    }
  }
}
