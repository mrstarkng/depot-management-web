// Enums matching backend DepotEnums.cs

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

// Domain models

export interface YardBlock {
  id: number;
  code: string;
  blockType: YardBlockType;
  bayCount?: number;
  rowCount?: number;
  tierCount?: number;
}

export interface DepotContainer {
  id: number;
  containerNumber: string;
  containerType?: string;
  isoCode?: string;
  containerSize?: string;
  maximumWeight?: number;
  tareWeight?: number;
  dateOfManufacture?: string;
  containerOwner?: string;
  containerCondition: ContainerConditionStatus;
}

export interface LineOperator {
  id: number;
  code: string;
  name: string;
}

export interface Customer {
  id: number;
  taxCode: string;
  name: string;
}

export interface ContainerVisit {
  id: number;
  depotContainerId: number;
  lineOperatorId: number;
  yardBlockId: number;
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
  deliveryOrderId?: number;
}

export interface ContainerMovement {
  id: number;
  containerVisitId: number;
  movementType: ContainerMovementType;
  movementAt: string;
  yardBlockId: number;
  bay?: number;
  row?: number;
  tier?: number;
  vehicle?: string;
  note?: string;
}

export interface DeliveryOrder {
  id: number;
  lineOperatorId: number;
  customerId: number;
  orderNumber: string;
  orderExpiryDate: string;
  outboundVessel?: string;
  lines?: DeliveryOrderLine[];
}

export interface DeliveryOrderLine {
  id: number;
  deliveryOrderId: number;
  containerType: string;
  quantity: number;
  releasedQuantity: number;
}
