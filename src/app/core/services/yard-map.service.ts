import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, map } from 'rxjs';
import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import {
  YardMapOverview,
  YardMapBlockDetail,
  YardMapHeatmapCell,
  YardMapRealtimeEvent,
} from '../models/depot.models';
import { AuthService } from './auth.service';

interface YardMapBlockApi {
  id: number;
  code: string;
  name: string;
  bayCount: number;
  rowCount: number;
  tierCount: number;
  maxCapacity?: number;
  occupiedSlots: number;
  positionedContainers: number;
  unpositionedContainers: number;
  availableSlots: number;
  occupancyPercentage: number;
}

interface YardMapSnapshotApi {
  generatedAt: string;
  blocks: YardMapBlockApi[];
}

interface YardMapSlotApi {
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

@Injectable({ providedIn: 'root' })
export class YardMapService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly baseUrl = '/api/yard-map';
  private readonly hubUrl = '/hubs/yard-map';

  private hubConnection: HubConnection | null = null;
  private readonly eventsSubject = new Subject<YardMapRealtimeEvent>();
  readonly events$ = this.eventsSubject.asObservable();

  getOverview(): Observable<YardMapOverview> {
    return this.http.get<YardMapSnapshotApi>(this.baseUrl).pipe(
      map(snapshot => ({
        blocks: snapshot.blocks.map(block => this.mapBlock(block)),
        slots: [],
      })),
    );
  }

  getBlockDetail(blockCode: string): Observable<YardMapBlockDetail> {
    return this.http.get<YardMapBlockDetailApi>(`${this.baseUrl}/${encodeURIComponent(blockCode)}`).pipe(
      map(detail => ({
        block: this.mapBlock(detail),
        slots: detail.slots.map((slot, index) => this.mapSlot(slot, index)),
      })),
    );
  }

  getHeatmap(): Observable<YardMapHeatmapCell[]> {
    return this.http.get<YardMapHeatmapCellApi[]>(`${this.baseUrl}/heatmap`).pipe(
      map(cells => cells.map(cell => ({
        blockCode: cell.blockCode,
        bay: cell.bay ?? undefined,
        row: cell.row ?? undefined,
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
        dwellTimeDays: cell.value,
      }))),
    );
  }

  async connect(): Promise<void> {
    if (this.hubConnection && this.hubConnection.state !== 'Disconnected') {
      return;
    }

    this.hubConnection = new HubConnectionBuilder()
      .withUrl(this.hubUrl, {
        accessTokenFactory: () => this.authService.getToken() ?? '',
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    this.hubConnection.on('ContainerGateIn', (payload: YardMapRealtimeEvent) => {
      this.eventsSubject.next({ ...payload, eventType: 'ContainerGateIn' });
    });

    this.hubConnection.on('ContainerMoved', (payload: YardMapRealtimeEvent) => {
      this.eventsSubject.next({ ...payload, eventType: 'ContainerMoved' });
    });

    this.hubConnection.on('ContainerGateOut', (payload: YardMapRealtimeEvent) => {
      this.eventsSubject.next({ ...payload, eventType: 'ContainerGateOut' });
    });

    await this.hubConnection.start();
  }

  async disconnect(): Promise<void> {
    if (!this.hubConnection) {
      return;
    }

    await this.hubConnection.stop();
    this.hubConnection = null;
  }

  private mapBlock(block: YardMapBlockApi) {
    return {
      blockCode: block.code,
      blockName: block.name,
      bayCount: block.bayCount,
      rowCount: block.rowCount,
      tierCount: block.tierCount,
      maxCapacity: block.maxCapacity ?? this.deriveCapacity(block),
      occupiedSlots: block.occupiedSlots,
      occupancyPercent: Math.round(block.occupancyPercentage),
    };
  }

  private mapSlot(slot: YardMapSlotApi, index: number) {
    return {
      visitId: index + 1,
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
}
