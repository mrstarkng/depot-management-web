import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, map } from 'rxjs';
import {
  LineOperator, Customer, YardBlock, CreateYardBlockRequest, UpdateYardBlockRequest,
  DepotContainer, ContainerOverview, CreateDepotContainerRequest, UpdateDepotContainerRequest, ContainerCurrentLocation,
  ContainerVisitHistory, InboundContainerRequest, OutboundContainerRequest,
  RelocateContainerRequest, ContainerVisit, ContainerMovement, DeliveryOrder,
  CreateDeliveryOrderRequest, EligibleContainer, DepotDashboard,
  YardMapOverview, YardMapBlockDetail, YardMapHeatmapCell, YardBlockType,
  StackStateDto, ThroughputEntry, StockByOperatorEntry,
} from '../models/depot.models';

@Injectable({ providedIn: 'root' })
export class DepotService {
  private readonly baseUrl = '/api';

  constructor(private readonly http: HttpClient) {}

  // ── Dashboard ──
  getDashboard(): Observable<DepotDashboard> {
    return this.http.get<DepotDashboard>(`${this.baseUrl}/dashboard`);
  }

  /** SSC §5.4 — Inbound/outbound count per day per LineOperator. */
  getThroughput(from: Date, to: Date): Observable<ThroughputEntry[]> {
    const params = new HttpParams()
      .set('from', toIsoDate(from))
      .set('to', toIsoDate(to))
      .set('groupBy', 'line-operator');
    return this.http.get<ThroughputEntry[]>(`${this.baseUrl}/dashboard/throughput`, { params });
  }

  /** SSC §5.2 — Fresh vs long-stay container count per LineOperator. */
  getStockByOperator(): Observable<StockByOperatorEntry[]> {
    return this.http.get<StockByOperatorEntry[]>(`${this.baseUrl}/dashboard/stock-by-operator`);
  }

  // ── Line Operators ──
  getLineOperators(): Observable<LineOperator[]> {
    return this.http.get<LineOperator[]>(`${this.baseUrl}/line-operators`);
  }

  createLineOperator(req: Partial<LineOperator>): Observable<LineOperator> {
    return this.http.post<LineOperator>(`${this.baseUrl}/line-operators`, req);
  }

  updateLineOperator(id: number, req: Partial<LineOperator>): Observable<LineOperator> {
    return this.http.put<LineOperator>(`${this.baseUrl}/line-operators/${id}`, req);
  }

  deleteLineOperator(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/line-operators/${id}`);
  }

  // ── Customers ──
  getCustomers(): Observable<Customer[]> {
    return this.http.get<Customer[]>(`${this.baseUrl}/customers`);
  }

  createCustomer(req: Partial<Customer>): Observable<Customer> {
    return this.http.post<Customer>(`${this.baseUrl}/customers`, req);
  }

  updateCustomer(id: number, req: Partial<Customer>): Observable<Customer> {
    return this.http.put<Customer>(`${this.baseUrl}/customers/${id}`, req);
  }

  deleteCustomer(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/customers/${id}`);
  }

  // ── Yard Blocks ──
  getYardBlocks(blockType?: string): Observable<YardBlock[]> {
    let params = new HttpParams();
    if (blockType) params = params.set('blockType', blockType);
    return this.http.get<YardBlock[]>(`${this.baseUrl}/yard-blocks`, { params }).pipe(
      map(blocks => blocks.map(block => this.normalizeYardBlock(block))),
    );
  }

  getYardBlock(id: number): Observable<YardBlock> {
    return this.http.get<YardBlock>(`${this.baseUrl}/yard-blocks/${id}`).pipe(
      map(block => this.normalizeYardBlock(block)),
    );
  }

  createYardBlock(req: CreateYardBlockRequest): Observable<YardBlock> {
    return this.http.post<YardBlock>(`${this.baseUrl}/yard-blocks`, req).pipe(
      map(block => this.normalizeYardBlock(block)),
    );
  }

  updateYardBlock(id: number, req: UpdateYardBlockRequest): Observable<YardBlock> {
    return this.http.put<YardBlock>(`${this.baseUrl}/yard-blocks/${id}`, req).pipe(
      map(block => this.normalizeYardBlock(block)),
    );
  }

  deleteYardBlock(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/yard-blocks/${id}`);
  }

  /** DEC-010 — Manager-only. Promotes an extension block to core (one-way). */
  promoteBlockToCore(id: number): Observable<YardBlock> {
    return this.http.post<YardBlock>(`${this.baseUrl}/yard-blocks/${id}/promote-core`, {});
  }

  /** EP-YBSTACK-01 — returns occupancy of every tier at a given bay/row slot. */
  getBlockStackState(blockId: number, bay: number, row: number): Observable<StackStateDto> {
    const params = new HttpParams().set('bay', bay.toString()).set('row', row.toString());
    return this.http.get<StackStateDto>(`${this.baseUrl}/yard-blocks/${blockId}/stack-state`, { params });
  }

  // ── Containers ──
  getContainers(query?: {
    search?: string;
    containerType?: string;
    containerOwner?: string;
    containerCondition?: string;
  }): Observable<DepotContainer[]> {
    let params = new HttpParams();
    if (query?.search) params = params.set('search', query.search);
    if (query?.containerType) params = params.set('containerType', query.containerType);
    if (query?.containerOwner) params = params.set('containerOwner', query.containerOwner);
    if (query?.containerCondition) params = params.set('containerCondition', query.containerCondition);
    return this.http.get<DepotContainer[]>(`${this.baseUrl}/containers`, { params });
  }

  getContainerOverviews(): Observable<ContainerOverview[]> {
    return forkJoin({
      containers: this.getContainers(),
      visits: this.getContainerVisits({ status: 'InDepot' }),
    }).pipe(
      map(({ containers, visits }) => {
        const visitMap = new Map<string, ContainerVisit>();
        for (const v of visits) {
          visitMap.set(v.containerNumber, v);
        }
        return containers.map(c => {
          const visit = visitMap.get(c.containerNumber);
          return {
            containerId: c.id,
            containerNumber: c.containerNumber,
            containerType: c.containerType,
            isoCode: c.isoCode,
            containerSize: c.containerSize,
            maximumWeight: c.maximumWeight,
            tareWeight: c.tareWeight,
            dateOfManufacture: c.dateOfManufacture,
            containerOwner: c.containerOwner,
            containerCondition: c.containerCondition,
            isActive: c.isActive,
            description: c.description,
            isInDepot: !!visit,
            visitStatus: visit?.status,
            currentBlockCode: visit?.yardBlockCode,
            bay: visit?.bay,
            row: visit?.row,
            tier: visit?.tier,
            lineOperatorCode: visit?.lineOperatorCode,
            classification: visit?.classification,
            inboundAt: visit?.inboundAt,
            outboundAt: visit?.outboundAt,
          } as ContainerOverview;
        });
      }),
    );
  }

  getContainerById(id: number): Observable<DepotContainer> {
    return this.http.get<DepotContainer>(`${this.baseUrl}/containers/${id}`);
  }

  getContainerByNumber(containerNumber: string): Observable<DepotContainer> {
    return this.http.get<DepotContainer>(`${this.baseUrl}/containers/by-number/${containerNumber}`);
  }

  createContainer(req: CreateDepotContainerRequest): Observable<DepotContainer> {
    return this.http.post<DepotContainer>(`${this.baseUrl}/containers`, req);
  }

  updateContainer(id: number, req: UpdateDepotContainerRequest): Observable<DepotContainer> {
    return this.http.put<DepotContainer>(`${this.baseUrl}/containers/${id}`, req);
  }

  deleteContainer(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/containers/${id}`);
  }

  getCurrentLocation(containerNumber: string): Observable<ContainerCurrentLocation> {
    return this.http.get<ContainerCurrentLocation>(`${this.baseUrl}/containers/${containerNumber}/current-location`);
  }

  getVisitHistory(containerNumber: string): Observable<ContainerVisitHistory[]> {
    return this.http.get<ContainerVisitHistory[]>(`${this.baseUrl}/containers/${containerNumber}/visit-history`);
  }

  // ── Container Visits (Lifecycle) ──
  getContainerVisits(query?: {
    containerNumber?: string;
    yardBlockId?: number;
    lineOperatorId?: number;
    status?: string;
  }): Observable<ContainerVisit[]> {
    let params = new HttpParams();
    if (query?.containerNumber) params = params.set('containerNumber', query.containerNumber);
    if (query?.yardBlockId) params = params.set('yardBlockId', query.yardBlockId.toString());
    if (query?.lineOperatorId) params = params.set('lineOperatorId', query.lineOperatorId.toString());
    if (query?.status) params = params.set('status', query.status);
    return this.http.get<ContainerVisit[]>(`${this.baseUrl}/container-visits`, { params });
  }

  getContainerVisit(id: number): Observable<ContainerVisit> {
    return this.http.get<ContainerVisit>(`${this.baseUrl}/container-visits/${id}`);
  }

  getMovements(visitId: number): Observable<ContainerMovement[]> {
    return this.http.get<ContainerMovement[]>(`${this.baseUrl}/container-visits/${visitId}/movements`);
  }

  inboundContainer(req: InboundContainerRequest): Observable<ContainerVisit> {
    return this.http.post<ContainerVisit>(`${this.baseUrl}/container-visits/gate-in`, req);
  }

  outboundContainer(req: OutboundContainerRequest): Observable<ContainerVisit> {
    return this.http.post<ContainerVisit>(`${this.baseUrl}/container-visits/gate-out`, req);
  }

  relocateContainer(req: RelocateContainerRequest): Observable<ContainerVisit> {
    return this.http.post<ContainerVisit>(`${this.baseUrl}/container-visits/relocate`, req);
  }

  // ── Delivery Orders ──
  getDeliveryOrders(query?: {
    search?: string;
    lineOperatorId?: number;
    customerId?: number;
    isExpired?: boolean;
    hasRemainingQuantity?: boolean;
  }): Observable<DeliveryOrder[]> {
    let params = new HttpParams();
    if (query?.search) params = params.set('search', query.search);
    if (query?.lineOperatorId) params = params.set('lineOperatorId', query.lineOperatorId.toString());
    if (query?.customerId) params = params.set('customerId', query.customerId.toString());
    if (query?.isExpired !== undefined) params = params.set('isExpired', query.isExpired.toString());
    if (query?.hasRemainingQuantity !== undefined) params = params.set('hasRemainingQuantity', query.hasRemainingQuantity.toString());
    return this.http.get<DeliveryOrder[]>(`${this.baseUrl}/delivery-orders`, { params });
  }

  getDeliveryOrder(orderNumber: string): Observable<DeliveryOrder> {
    return this.http.get<DeliveryOrder>(`${this.baseUrl}/delivery-orders/${orderNumber}`);
  }

  createDeliveryOrder(req: CreateDeliveryOrderRequest): Observable<DeliveryOrder> {
    return this.http.post<DeliveryOrder>(`${this.baseUrl}/delivery-orders`, req);
  }

  getEligibleContainers(orderNumber: string): Observable<EligibleContainer[]> {
    return this.http.get<EligibleContainer[]>(`${this.baseUrl}/delivery-orders/${orderNumber}/eligible-containers`);
  }

  // ── Yard Map ──
  getYardMapOverview(): Observable<YardMapOverview> {
    return this.http.get<YardMapOverview>(`${this.baseUrl}/yard-map`);
  }

  getYardMapBlockDetail(blockCode: string): Observable<YardMapBlockDetail> {
    return this.http.get<YardMapBlockDetail>(`${this.baseUrl}/yard-map/${encodeURIComponent(blockCode)}`);
  }

  getYardMapHeatmap(): Observable<YardMapHeatmapCell[]> {
    return this.http.get<YardMapHeatmapCell[]>(`${this.baseUrl}/yard-map/heatmap`);
  }

  getYardMapDwellHeatmap(): Observable<YardMapHeatmapCell[]> {
    return this.http.get<YardMapHeatmapCell[]>(`${this.baseUrl}/yard-map/heatmap/dwell-time`);
  }

  private normalizeYardBlock(block: YardBlock): YardBlock {
    return {
      ...block,
      maxCapacity: block.maxCapacity ?? this.deriveYardBlockCapacity(block),
    };
  }

  private deriveYardBlockCapacity(block: Pick<YardBlock, 'blockType' | 'bayCount' | 'rowCount' | 'tierCount'>): number | undefined {
    if (block.blockType !== YardBlockType.Physical) {
      return undefined;
    }

    const bayCount = block.bayCount ?? 0;
    const rowCount = block.rowCount ?? 0;
    const tierCount = block.tierCount ?? 0;

    return bayCount > 0 && rowCount > 0 && tierCount > 0
      ? bayCount * rowCount * tierCount
      : undefined;
  }
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
