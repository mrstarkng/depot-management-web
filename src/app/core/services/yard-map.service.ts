import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  BehaviorSubject,
  Observable,
  Subject,
  interval,
  map,
  switchMap,
} from 'rxjs';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import {
  YardMapOverview,
  YardMapBlockDetail,
  YardMapHeatmapCell,
  YardMapRealtimeEvent,
  YardMapBlock,
  YardMapFacility,
  YardMapContainerSlot,
  YardBlockCategory,
  YardBlockRotation,
  YardLayoutLockDto,
  LayoutLockRequestPayload,
  LayoutGrantRequest,
  LayoutSaveRequest,
} from '../models/depot.models';
import { AuthService } from './auth.service';

interface YardMapBlockApi {
  id: number;
  code: string;
  name: string;
  bayCount: number;
  rowCount: number;
  tierCount: number;
  maxCapacity?: number | null;
  occupiedSlots: number;
  positionedContainers: number;
  unpositionedContainers: number;
  availableSlots: number;
  occupancyPercentage: number;
  category?: string;
  colorOverride?: string | null;
  canvasX?: number;
  canvasY?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  rotation?: number;
  rowVersion?: string | null;
}

interface YardMapFacilityApi {
  code: string;
  label: string;
  kind: string;
  canvasX: number;
  canvasY: number;
  canvasWidth: number;
  canvasHeight: number;
  rotation?: number;
  colorToken?: string;
}

interface YardMapSnapshotApi {
  generatedAt: string;
  revision?: string;
  blocks: YardMapBlockApi[];
  facilities?: YardMapFacilityApi[];
}

interface YardMapSlotApi {
  visitId?: number;
  blockCode: string;
  bay: number;
  row: number;
  tier: number;
  containerNumber: string;
  containerType: string;
  containerSize: string;
  lineOperatorCode: string;
  classification: string;
  condition: string;
  inboundAt: string;
  lastMovementAt: string;
  dwellDays: number;
}

interface YardMapBlockDetailApi extends YardMapBlockApi {
  slots: YardMapSlotApi[];
}

interface YardMapHeatmapCellApi {
  blockCode: string;
  bay?: number | null;
  row?: number | null;
  tier?: number | null;
  value: number;
}

export type YardMapConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

@Injectable({ providedIn: 'root' })
export class YardMapService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly baseUrl = '/api/yard-map';
  private readonly hubUrl = '/hubs/yard-map';

  private hubConnection: HubConnection | null = null;
  private readonly eventsSubject = new Subject<YardMapRealtimeEvent>();
  readonly events$ = this.eventsSubject.asObservable();

  private readonly connectionStateSubject = new BehaviorSubject<YardMapConnectionState>('disconnected');
  readonly connectionState$ = this.connectionStateSubject.asObservable();

  // ── Read endpoints ─────────────────────────────────────────────────────────
  getOverview(): Observable<YardMapOverview> {
    return this.http.get<YardMapSnapshotApi>(this.baseUrl).pipe(
      map(snapshot => ({
        generatedAt: snapshot.generatedAt,
        revision: snapshot.revision,
        blocks: snapshot.blocks.map(block => this.mapBlock(block)),
        facilities: (snapshot.facilities ?? []).map(f => this.mapFacility(f)),
        slots: [],
      })),
    );
  }

  getBlockDetail(blockCode: string): Observable<YardMapBlockDetail> {
    return this.http.get<YardMapBlockDetailApi>(`${this.baseUrl}/${encodeURIComponent(blockCode)}`).pipe(
      map(detail => ({
        block: this.mapBlock(detail),
        slots: (detail.slots ?? []).map((slot, index) => this.mapSlot(slot, index)),
      })),
    );
  }

  getHeatmap(): Observable<YardMapHeatmapCell[]> {
    return this.http.get<YardMapHeatmapCellApi[]>(`${this.baseUrl}/heatmap`).pipe(
      map(cells => cells.map(cell => ({
        blockCode: cell.blockCode,
        bay: cell.bay ?? undefined,
        row: cell.row ?? undefined,
        tier: cell.tier ?? undefined,
        occupancyPercent: cell.value,
      }))),
    );
  }

  getDwellHeatmap(): Observable<YardMapHeatmapCell[]> {
    return this.http.get<YardMapHeatmapCellApi[]>(`${this.baseUrl}/heatmap/dwell-time`).pipe(
      map(cells => cells.map(cell => ({
        blockCode: cell.blockCode,
        bay: cell.bay ?? undefined,
        row: cell.row ?? undefined,
        tier: cell.tier ?? undefined,
        dwellTimeDays: cell.value,
      }))),
    );
  }

  // ── Lock endpoints ─────────────────────────────────────────────────────────
  getLockStatus(): Observable<YardLayoutLockDto | null> {
    return this.http
      .get<YardLayoutLockDto>(`${this.baseUrl}/layout/lock`, { observe: 'response' })
      .pipe(map(res => (res.status === 204 ? null : res.body)));
  }

  requestLock(payload?: LayoutLockRequestPayload): Observable<YardLayoutLockDto> {
    return this.http.post<YardLayoutLockDto>(`${this.baseUrl}/layout/lock/request`, payload ?? {});
  }

  grantLock(req: LayoutGrantRequest): Observable<YardLayoutLockDto> {
    return this.http.post<YardLayoutLockDto>(`${this.baseUrl}/layout/lock/grant`, req);
  }

  heartbeat(): Observable<YardLayoutLockDto> {
    return this.http.post<YardLayoutLockDto>(`${this.baseUrl}/layout/lock/heartbeat`, {});
  }

  releaseLock(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/layout/lock/release`, {});
  }

  revokeLock(reason?: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/layout/lock/revoke`, { reason });
  }

  saveLayout(req: LayoutSaveRequest): Observable<YardMapOverview> {
    return this.http.put<YardMapSnapshotApi>(`${this.baseUrl}/layout`, req).pipe(
      map(snapshot => ({
        generatedAt: snapshot.generatedAt,
        revision: snapshot.revision,
        blocks: snapshot.blocks.map(block => this.mapBlock(block)),
        facilities: (snapshot.facilities ?? []).map(f => this.mapFacility(f)),
        slots: [],
      })),
    );
  }

  /**
   * Emits every `intervalMs` while subscribed; each emission performs a heartbeat.
   * Returns the mapped DTO so callers can track expiresAt.
   */
  heartbeat$(intervalMs = 60000): Observable<YardLayoutLockDto> {
    return interval(intervalMs).pipe(switchMap(() => this.heartbeat()));
  }

  // ── Hub lifecycle ──────────────────────────────────────────────────────────
  async connect(): Promise<void> {
    if (this.hubConnection && this.hubConnection.state !== HubConnectionState.Disconnected) {
      return;
    }

    this.connectionStateSubject.next('connecting');

    this.hubConnection = new HubConnectionBuilder()
      .withUrl(this.hubUrl, {
        accessTokenFactory: () => this.authService.getToken() ?? '',
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    const forwardEvent = (
      eventType: YardMapRealtimeEvent['eventType'],
    ) => (payload: YardMapRealtimeEvent) => {
      this.eventsSubject.next({ ...(payload ?? {}), eventType });
    };

    this.hubConnection.on('ContainerGateIn', forwardEvent('ContainerGateIn'));
    this.hubConnection.on('ContainerMoved', forwardEvent('ContainerMoved'));
    this.hubConnection.on('ContainerGateOut', forwardEvent('ContainerGateOut'));
    this.hubConnection.on('LayoutLockAcquired', forwardEvent('LayoutLockAcquired'));
    this.hubConnection.on('LayoutLockReleased', forwardEvent('LayoutLockReleased'));
    this.hubConnection.on('LayoutLockExpired', forwardEvent('LayoutLockExpired'));
    this.hubConnection.on('LayoutLockRequested', forwardEvent('LayoutLockRequested'));
    this.hubConnection.on('LayoutSaved', forwardEvent('LayoutSaved'));

    this.hubConnection.onreconnecting(() => this.connectionStateSubject.next('reconnecting'));
    this.hubConnection.onreconnected(() => this.connectionStateSubject.next('connected'));
    this.hubConnection.onclose(() => this.connectionStateSubject.next('disconnected'));

    try {
      await this.hubConnection.start();
      this.connectionStateSubject.next('connected');
    } catch (err) {
      this.connectionStateSubject.next('disconnected');
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.hubConnection) {
      return;
    }

    try {
      await this.hubConnection.stop();
    } finally {
      this.hubConnection = null;
      this.connectionStateSubject.next('disconnected');
    }
  }

  // ── Mappers ────────────────────────────────────────────────────────────────
  private mapBlock(block: YardMapBlockApi): YardMapBlock {
    return {
      id: block.id,
      blockCode: block.code,
      blockName: block.name,
      bayCount: block.bayCount,
      rowCount: block.rowCount,
      tierCount: block.tierCount,
      maxCapacity: block.maxCapacity ?? this.deriveCapacity(block) ?? undefined,
      occupiedSlots: block.occupiedSlots,
      occupancyPercent: Math.round(block.occupancyPercentage),
      canvasX: block.canvasX ?? 0,
      canvasY: block.canvasY ?? 0,
      canvasWidth: block.canvasWidth ?? Math.max(block.bayCount, 1),
      canvasHeight: block.canvasHeight ?? Math.max(block.rowCount, 1),
      rotation: this.normalizeRotation(block.rotation),
      category: this.normalizeCategory(block.category),
      colorOverride: block.colorOverride ?? null,
      rowVersion: block.rowVersion ?? null,
    };
  }

  private mapFacility(f: YardMapFacilityApi): YardMapFacility {
    return {
      code: f.code,
      label: f.label,
      kind: f.kind,
      canvasX: f.canvasX,
      canvasY: f.canvasY,
      canvasWidth: f.canvasWidth,
      canvasHeight: f.canvasHeight,
      rotation: this.normalizeRotation(f.rotation),
      colorToken: f.colorToken,
    };
  }

  private mapSlot(slot: YardMapSlotApi, index: number): YardMapContainerSlot {
    return {
      visitId: slot.visitId ?? index + 1,
      blockCode: slot.blockCode,
      bay: slot.bay,
      row: slot.row,
      tier: slot.tier,
      containerNumber: slot.containerNumber,
      containerType: slot.containerType,
      containerSize: slot.containerSize,
      lineOperatorCode: slot.lineOperatorCode,
      classification: slot.classification as any,
      condition: slot.condition as any,
      inboundAt: slot.inboundAt,
      lastMovementAt: slot.lastMovementAt,
      dwellDays: slot.dwellDays,
    };
  }

  private deriveCapacity(block: Pick<YardMapBlockApi, 'bayCount' | 'rowCount' | 'tierCount'>): number | undefined {
    return block.bayCount > 0 && block.rowCount > 0 && block.tierCount > 0
      ? block.bayCount * block.rowCount * block.tierCount
      : undefined;
  }

  private normalizeRotation(raw: number | undefined): YardBlockRotation {
    if (raw === 90 || raw === 180 || raw === 270) return raw;
    return 0;
  }

  private normalizeCategory(raw: string | undefined): YardBlockCategory {
    const match = Object.values(YardBlockCategory).find(c => c === raw);
    return (match as YardBlockCategory) ?? YardBlockCategory.Standard;
  }
}
