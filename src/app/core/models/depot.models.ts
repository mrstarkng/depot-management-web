// ── Enums ──
export enum YardBlockType {
  Physical = 'Physical',
  Virtual = 'Virtual',
}

export enum ContainerGrade {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
}

export enum ContainerConditionStatus {
  Normal = 'Normal',
  Damaged = 'Damaged',
}

export enum ContainerVisitStatus {
  InDepot = 'InDepot',
  Released = 'Released',
}

export enum ContainerMovementType {
  Inbound = 'Inbound',
  Relocated = 'Relocated',
  Outbound = 'Outbound',
}

// ── Master Data ──
export interface LineOperator {
  id: number;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  contactPerson?: string;
  country?: string;
  isActive?: boolean;
}

export interface Customer {
  id: number;
  taxCode: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  contactPerson?: string;
  isActive?: boolean;
}

// ── Yard ──
export interface YardBlock {
  id: number;
  code: string;
  name: string;
  blockType: YardBlockType;
  bayCount?: number;
  rowCount?: number;
  tierCount?: number;
  maxCapacity?: number;
  isActive: boolean;
  /** DEC-010 — true for seeded "core" blocks that cannot be structurally changed. */
  isCore: boolean;
  description?: string;
  activeContainerCount: number;
  category?: YardBlockCategory;
}

export interface CreateYardBlockRequest {
  code: string;
  name: string;
  blockType: YardBlockType;
  category?: YardBlockCategory;
  bayCount?: number;
  rowCount?: number;
  tierCount?: number;
  maxCapacity?: number;
  description?: string;
}

export interface UpdateYardBlockRequest extends CreateYardBlockRequest {}

// ── Container ──
export interface DepotContainer {
  id: number;
  containerNumber: string;
  containerType: string;
  isoCode: string;
  containerSize: string;
  maximumWeight: number;
  tareWeight: number;
  dateOfManufacture?: string;
  containerOwner: string;
  containerCondition: ContainerConditionStatus;
  isActive: boolean;
  description?: string;
}

export interface ContainerOverview {
  containerId: number;
  containerNumber: string;
  containerType: string;
  isoCode: string;
  containerSize: string;
  maximumWeight: number;
  tareWeight: number;
  dateOfManufacture?: string;
  containerOwner: string;
  containerCondition: ContainerConditionStatus;
  isActive: boolean;
  description?: string;
  visitStatus?: ContainerVisitStatus;
  currentBlockCode?: string;
  bay?: number;
  row?: number;
  tier?: number;
  lineOperatorCode?: string;
  classification?: ContainerGrade;
  inboundAt?: string;
  outboundAt?: string;
  isInDepot: boolean;
}

export interface CreateDepotContainerRequest {
  containerNumber: string;
  containerType: string;
  isoCode: string;
  containerSize: string;
  maximumWeight: number;
  tareWeight: number;
  dateOfManufacture?: string;
  containerOwner: string;
  containerCondition: ContainerConditionStatus;
  description?: string;
}

export interface UpdateDepotContainerRequest {
  containerType: string;
  isoCode: string;
  containerSize: string;
  maximumWeight: number;
  tareWeight: number;
  dateOfManufacture?: string;
  containerOwner: string;
  containerCondition: ContainerConditionStatus;
  isActive: boolean;
  description?: string;
}

export interface ContainerCurrentLocation {
  containerNumber: string;
  isInDepot: boolean;
  visitStatus?: ContainerVisitStatus;
  yardBlockCode?: string;
  bay?: number;
  row?: number;
  tier?: number;
  lineOperatorCode?: string;
  classification?: ContainerGrade;
  condition?: ContainerConditionStatus;
  inboundAt?: string;
  lastMovementAt?: string;
}

// ── Lifecycle ──
export interface InboundContainerRequest {
  containerNumber: string;
  lineOperatorId: number;
  yardBlockId: number;
  bay?: number;
  row?: number;
  tier?: number;
  classification: ContainerGrade;
  condition: ContainerConditionStatus;
  inboundVehicle: string;
  inboundAt?: string;
}

export interface OutboundContainerRequest {
  containerNumber: string;
  orderNumber?: string;
  outboundVehicle: string;
  outboundAt?: string;
}

export interface RelocateContainerRequest {
  containerNumber: string;
  yardBlockId: number;
  bay?: number;
  row?: number;
  tier?: number;
  classification: ContainerGrade;
  condition: ContainerConditionStatus;
  reason: string;
  movedAt?: string;
}

export interface ContainerVisit {
  id: number;
  containerNumber: string;
  lineOperatorId: number;
  lineOperatorCode: string;
  yardBlockId: number;
  yardBlockCode: string;
  bay?: number;
  row?: number;
  tier?: number;
  classification: ContainerGrade;
  condition: ContainerConditionStatus;
  inboundVehicle: string;
  outboundVehicle?: string;
  inboundAt: string;
  outboundAt?: string;
  status: ContainerVisitStatus;
  deliveryOrderNumber?: string;
  lastMovementAt?: string;
}

export interface ContainerMovement {
  id: number;
  movementType: ContainerMovementType;
  movementAt: string;
  yardBlockId: number;
  yardBlockCode: string;
  bay?: number;
  row?: number;
  tier?: number;
  vehicle?: string;
  note?: string;
}

export interface ContainerVisitHistory {
  visitId: number;
  containerNumber: string;
  lineOperatorCode: string;
  inboundAt: string;
  outboundAt?: string;
  status: ContainerVisitStatus;
  deliveryOrderNumber?: string;
  movements: ContainerMovement[];
}

// ── Delivery Order ──
export interface DeliveryOrderLine {
  id: number;
  containerType: string;
  containerSize?: string;
  isoCode?: string;
  quantity: number;
  releasedQuantity: number;
  remainingQuantity: number;
  availableInDepotQuantity: number;
  canBeFulfilledFromDepotStock: boolean;
}

export interface DeliveryOrder {
  id: number;
  lineOperatorId: number;
  lineOperatorCode: string;
  lineOperatorName: string;
  customerId: number;
  customerTaxCode: string;
  customerName: string;
  orderNumber: string;
  orderDate?: string;
  orderExpiryDate: string;
  outboundVessel: string;
  voyageNumber?: string;
  remarks?: string;
  isExpired: boolean;
  hasRemainingQuantity: boolean;
  isFulfilled: boolean;
  totalRequestedQuantity: number;
  totalReleasedQuantity: number;
  totalRemainingQuantity: number;
  lines: DeliveryOrderLine[];
}

export interface CreateDeliveryOrderRequest {
  lineOperatorId: number;
  customerId: number;
  orderNumber: string;
  orderExpiryDate: string;
  outboundVessel: string;
  lines: { containerType: string; quantity: number }[];
}

export interface EligibleContainer {
  containerId: number;
  containerNumber: string;
  containerType: string;
  lineOperatorCode: string;
  yardBlockCode: string;
  bay?: number;
  row?: number;
  tier?: number;
  classification: ContainerGrade;
  condition: ContainerConditionStatus;
  inboundAt: string;
}

// ── Dashboard ──
export interface BlockOccupancy {
  blockCode: string;
  blockName?: string;
  activeContainers: number;
  maxCapacity?: number;
}

export interface RecentActivityItem {
  time: string;
  containerNumber: string;
  action: string;
  blockCode: string;
  operatorName?: string;
}

export interface ExpiringSoonOrder {
  orderNumber: string;
  operatorName: string;
  expiryDate: string;
  remainingContainers: number;
}

export interface DepotDashboard {
  totalBlocks: number;
  totalContainers: number;
  activeVisits: number;
  activeDeliveryOrders: number;
  todayGateIn?: number;
  todayGateOut?: number;
  yardOccupancyPercent?: number;
  blockOccupancies: BlockOccupancy[];
  recentActivity?: RecentActivityItem[];
  expiringSoonOrders?: ExpiringSoonOrder[];
}

// ── Yard Map (DEC-009) ──
export enum YardBlockCategory {
  Standard = 'Standard',
  Reefer = 'Reefer',
  OOG = 'OOG',
  Hazardous = 'Hazardous',
  Damaged = 'Damaged',
  Empty = 'Empty',
  Repair = 'Repair',
  Inspection = 'Inspection',
  Bonded = 'Bonded',
  Service = 'Service',
  Future = 'Future',
}

export type YardBlockRotation = 0 | 90 | 180 | 270;

export interface YardMapContainerSlot {
  visitId: number;
  containerNumber: string;
  blockCode: string;
  bay: number;
  row: number;
  tier: number;
  containerType?: string;
  containerSize?: string;
  classification?: ContainerGrade;
  condition?: ContainerConditionStatus;
  lineOperatorCode?: string;
  inboundAt?: string;
  lastMovementAt?: string;
  movementType?: string;
  dwellDays?: number;
}

export interface YardMapBlock {
  id: number;
  blockCode: string;
  blockName?: string;
  blockType?: YardBlockType | string;
  bayCount: number;
  rowCount: number;
  tierCount?: number;
  maxCapacity?: number;
  occupiedSlots: number;
  occupancyPercent: number;
  canvasX: number;
  canvasY: number;
  canvasWidth: number;
  canvasHeight: number;
  rotation: YardBlockRotation;
  category: YardBlockCategory;
  colorOverride?: string | null;
  rowVersion?: string | null;
  /** DEC-010 — true when backend flags this block as "core" (seeded, immutable structure). */
  isCore?: boolean;
}

export interface YardMapFacility {
  code: string;
  label: string;
  kind: 'Gate' | 'Admin' | string;
  canvasX: number;
  canvasY: number;
  canvasWidth: number;
  canvasHeight: number;
  rotation: YardBlockRotation;
  colorToken?: string;
}

export interface YardMapOverview {
  generatedAt?: string;
  revision?: string;
  blocks: YardMapBlock[];
  facilities?: YardMapFacility[];
  slots: YardMapContainerSlot[];
}

export interface YardMapBlockDetail {
  block: YardMapBlock;
  slots: YardMapContainerSlot[];
}

export interface YardMapHeatmapCell {
  blockCode: string;
  bay?: number;
  row?: number;
  tier?: number;
  occupancyPercent?: number;
  dwellTimeDays?: number;
}

export interface YardMapRealtimeEvent {
  eventType:
    | 'ContainerGateIn'
    | 'ContainerMoved'
    | 'ContainerGateOut'
    | 'LayoutLockAcquired'
    | 'LayoutLockReleased'
    | 'LayoutLockExpired'
    | 'LayoutLockRequested'
    | 'LayoutSaved'
    | string;
  visitId?: number;
  containerNumber?: string;
  blockCode?: string;
  bay?: number;
  row?: number;
  tier?: number;
  movementType?: string;
  movedAt?: string;
}

export interface YardLayoutLockDto {
  id: number;
  eventType?: string;
  eventAt?: string;
  holderUserId: string;
  holderUserName?: string;
  holderFullName?: string;
  holderRole: string;
  grantedByUserId?: string | null;
  grantedByUserName?: string | null;
  revokedByUserId?: string | null;
  revokedByUserName?: string | null;
  acquiredAt: string;
  expiresAt: string;
  releasedAt?: string | null;
  releaseReason?: string | null;
  isActive: boolean;
}

export interface LayoutLockRequestedEvent {
  requesterUserId: string;
  requesterUserName?: string;
  requesterFullName?: string;
  reason?: string;
  requestedAt: string;
}

export interface LayoutSavedEvent {
  eventType: 'LayoutSaved';
  eventAt: string;
  savedByUserId: string;
  savedByUserName?: string;
  changedBlockCodes: string[];
  revision: string;
}

export interface LayoutGrantRequest {
  userId: string;
  ttlMinutes?: number;
  reason?: string;
}

export interface LayoutLockRequestPayload {
  reason?: string;
}

export interface LayoutBlockUpdate {
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

export interface LayoutSaveRequest {
  blocks: LayoutBlockUpdate[];
}
