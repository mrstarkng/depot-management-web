import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  YardBlock,
  DepotContainer,
  ContainerVisit,
  ContainerMovement,
  DeliveryOrder,
  LineOperator,
  Customer,
} from '../models/depot.models';

@Injectable({ providedIn: 'root' })
export class DepotService {
  private readonly baseUrl = '/api';

  constructor(private readonly http: HttpClient) {}

  // Yard Blocks
  getYardBlocks(): Observable<YardBlock[]> {
    return this.http.get<YardBlock[]>(`${this.baseUrl}/yard-blocks`);
  }

  getYardBlock(id: number): Observable<YardBlock> {
    return this.http.get<YardBlock>(`${this.baseUrl}/yard-blocks/${id}`);
  }

  createYardBlock(block: Partial<YardBlock>): Observable<YardBlock> {
    return this.http.post<YardBlock>(`${this.baseUrl}/yard-blocks`, block);
  }

  updateYardBlock(id: number, block: Partial<YardBlock>): Observable<YardBlock> {
    return this.http.put<YardBlock>(`${this.baseUrl}/yard-blocks/${id}`, block);
  }

  deleteYardBlock(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/yard-blocks/${id}`);
  }

  // Containers
  getContainers(): Observable<DepotContainer[]> {
    return this.http.get<DepotContainer[]>(`${this.baseUrl}/containers`);
  }

  getContainer(id: number): Observable<DepotContainer> {
    return this.http.get<DepotContainer>(`${this.baseUrl}/containers/${id}`);
  }

  getContainerByNumber(containerNumber: string): Observable<DepotContainer> {
    return this.http.get<DepotContainer>(`${this.baseUrl}/containers/by-number/${containerNumber}`);
  }

  createContainer(container: Partial<DepotContainer>): Observable<DepotContainer> {
    return this.http.post<DepotContainer>(`${this.baseUrl}/containers`, container);
  }

  updateContainer(id: number, container: Partial<DepotContainer>): Observable<DepotContainer> {
    return this.http.put<DepotContainer>(`${this.baseUrl}/containers/${id}`, container);
  }

  // Container Lifecycle
  getVisits(): Observable<ContainerVisit[]> {
    return this.http.get<ContainerVisit[]>(`${this.baseUrl}/container-lifecycle/visits`);
  }

  getVisit(id: number): Observable<ContainerVisit> {
    return this.http.get<ContainerVisit>(`${this.baseUrl}/container-lifecycle/visits/${id}`);
  }

  gateIn(visit: Partial<ContainerVisit>): Observable<ContainerVisit> {
    return this.http.post<ContainerVisit>(`${this.baseUrl}/container-lifecycle/gate-in`, visit);
  }

  gateOut(visitId: number, data: { outboundVehicle: string; deliveryOrderId?: number }): Observable<ContainerVisit> {
    return this.http.post<ContainerVisit>(`${this.baseUrl}/container-lifecycle/gate-out/${visitId}`, data);
  }

  relocate(visitId: number, movement: Partial<ContainerMovement>): Observable<ContainerMovement> {
    return this.http.post<ContainerMovement>(`${this.baseUrl}/container-lifecycle/relocate/${visitId}`, movement);
  }

  getMovements(visitId: number): Observable<ContainerMovement[]> {
    return this.http.get<ContainerMovement[]>(`${this.baseUrl}/container-lifecycle/visits/${visitId}/movements`);
  }

  // Delivery Orders
  getDeliveryOrders(): Observable<DeliveryOrder[]> {
    return this.http.get<DeliveryOrder[]>(`${this.baseUrl}/delivery-orders`);
  }

  getDeliveryOrder(id: number): Observable<DeliveryOrder> {
    return this.http.get<DeliveryOrder>(`${this.baseUrl}/delivery-orders/${id}`);
  }

  createDeliveryOrder(order: Partial<DeliveryOrder>): Observable<DeliveryOrder> {
    return this.http.post<DeliveryOrder>(`${this.baseUrl}/delivery-orders`, order);
  }

  updateDeliveryOrder(id: number, order: Partial<DeliveryOrder>): Observable<DeliveryOrder> {
    return this.http.put<DeliveryOrder>(`${this.baseUrl}/delivery-orders/${id}`, order);
  }

  // Master Data
  getLineOperators(): Observable<LineOperator[]> {
    return this.http.get<LineOperator[]>(`${this.baseUrl}/line-operators`);
  }

  getCustomers(): Observable<Customer[]> {
    return this.http.get<Customer[]>(`${this.baseUrl}/customers`);
  }
}
