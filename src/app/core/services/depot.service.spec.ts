import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { DepotService } from './depot.service';

describe('DepotService', () => {
  let service: DepotService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [DepotService],
    });
    service = TestBed.inject(DepotService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // DB-T01: DashboardService.get() calls GET /api/dashboard
  it('getDashboard() should call GET /api/dashboard', () => {
    service.getDashboard().subscribe();
    const req = httpMock.expectOne('/api/dashboard');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  // REF-T02: LineOperatorService.getAll() calls GET /api/line-operators
  it('getLineOperators() should call GET /api/line-operators', () => {
    service.getLineOperators().subscribe();
    const req = httpMock.expectOne('/api/line-operators');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  // REF-T01: CustomerService.getAll() calls GET /api/customers
  it('getCustomers() should call GET /api/customers', () => {
    service.getCustomers().subscribe();
    const req = httpMock.expectOne('/api/customers');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  // YB-T01: YardBlockService.getAll() calls GET /api/yard-blocks
  it('getYardBlocks() should call GET /api/yard-blocks', () => {
    service.getYardBlocks().subscribe();
    const req = httpMock.expectOne('/api/yard-blocks');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getYardBlocks() should pass blockType as query param', () => {
    service.getYardBlocks('Physical').subscribe();
    const req = httpMock.expectOne(r => r.url === '/api/yard-blocks' && r.params.get('blockType') === 'Physical');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  // YB-T02: YardBlockService.create() calls POST with request body
  it('createYardBlock() should call POST /api/yard-blocks', () => {
    const body = { code: 'A1', name: 'Block A1', blockType: 'Physical' as any };
    service.createYardBlock(body).subscribe();
    const req = httpMock.expectOne('/api/yard-blocks');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.code).toBe('A1');
    req.flush({});
  });

  // CT-T01: ContainerService.create() calls POST /api/containers
  it('createContainer() should call POST /api/containers', () => {
    const body = { containerNumber: 'MSCU1234567', containerType: 'DRY', isoCode: '22G1', containerSize: '20', maximumWeight: 30000, tareWeight: 2000, containerOwner: 'MSC', containerCondition: 'Normal' as any };
    service.createContainer(body).subscribe();
    const req = httpMock.expectOne('/api/containers');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.containerNumber).toBe('MSCU1234567');
    req.flush({});
  });

  // GET containers with query params
  it('getContainers() should pass search as query param', () => {
    service.getContainers({ search: 'MSCU' }).subscribe();
    const req = httpMock.expectOne(r => r.url === '/api/containers' && r.params.get('search') === 'MSCU');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getContainerByNumber() should call GET /api/containers/by-number/{number}', () => {
    service.getContainerByNumber('MSCU1234567').subscribe();
    const req = httpMock.expectOne('/api/containers/by-number/MSCU1234567');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('getCurrentLocation() should call GET /api/containers/{number}/current-location', () => {
    service.getCurrentLocation('MSCU1234567').subscribe();
    const req = httpMock.expectOne('/api/containers/MSCU1234567/current-location');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('getVisitHistory() should call GET /api/containers/{number}/visit-history', () => {
    service.getVisitHistory('MSCU1234567').subscribe();
    const req = httpMock.expectOne('/api/containers/MSCU1234567/visit-history');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  // IN-T01: ContainerVisitService.gateIn() calls POST /api/container-visits/gate-in
  it('inboundContainer() should call POST /api/container-visits/gate-in', () => {
    const body = { containerNumber: 'MSCU1234567', lineOperatorId: 1, yardBlockId: 1, classification: 'A' as any, condition: 'Normal' as any, inboundVehicle: 'TRK-001' };
    service.inboundContainer(body).subscribe();
    const req = httpMock.expectOne('/api/container-visits/gate-in');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.containerNumber).toBe('MSCU1234567');
    req.flush({});
  });

  // OUT-T01: ContainerVisitService.gateOut() calls POST /api/container-visits/gate-out
  it('outboundContainer() should call POST /api/container-visits/gate-out', () => {
    const body = { containerNumber: 'MSCU1234567', outboundVehicle: 'TRK-002' };
    service.outboundContainer(body).subscribe();
    const req = httpMock.expectOne('/api/container-visits/gate-out');
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  // OUT-T02: Request body has orderNumber = undefined when direct outbound
  it('outboundContainer() should omit orderNumber for direct outbound', () => {
    const body = { containerNumber: 'MSCU1234567', outboundVehicle: 'TRK-002' };
    service.outboundContainer(body).subscribe();
    const req = httpMock.expectOne('/api/container-visits/gate-out');
    expect(req.request.body.orderNumber).toBeUndefined();
    req.flush({});
  });

  // REL-T01: ContainerVisitService.relocate() calls POST /api/container-visits/relocate
  it('relocateContainer() should call POST /api/container-visits/relocate', () => {
    const body = { containerNumber: 'MSCU1234567', yardBlockId: 2, classification: 'A' as any, condition: 'Normal' as any, reason: 'Restack' };
    service.relocateContainer(body).subscribe();
    const req = httpMock.expectOne('/api/container-visits/relocate');
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  // DEP-T01: Service calls GET /api/container-visits?status=InDepot
  it('getContainerVisits() should pass status as query param', () => {
    service.getContainerVisits({ status: 'InDepot' }).subscribe();
    const req = httpMock.expectOne(r => r.url === '/api/container-visits' && r.params.get('status') === 'InDepot');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getMovements() should call GET /api/container-visits/{visitId}/movements', () => {
    service.getMovements(42).subscribe();
    const req = httpMock.expectOne('/api/container-visits/42/movements');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  // DO-T01: DeliveryOrderService.getAll() calls GET /api/delivery-orders
  it('getDeliveryOrders() should call GET /api/delivery-orders', () => {
    service.getDeliveryOrders().subscribe();
    const req = httpMock.expectOne('/api/delivery-orders');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  // DO-T02: DeliveryOrderService.create() calls POST /api/delivery-orders
  it('createDeliveryOrder() should call POST /api/delivery-orders', () => {
    const body = { orderNumber: 'DO-001', lineOperatorId: 1, customerId: 1, orderExpiryDate: '2099-01-01', outboundVessel: 'SHIP', lines: [{ containerType: 'DRY', quantity: 5 }] };
    service.createDeliveryOrder(body).subscribe();
    const req = httpMock.expectOne('/api/delivery-orders');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.orderNumber).toBe('DO-001');
    req.flush({});
  });

  it('getDeliveryOrder() should call GET /api/delivery-orders/{orderNumber}', () => {
    service.getDeliveryOrder('DO-001').subscribe();
    const req = httpMock.expectOne('/api/delivery-orders/DO-001');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('getEligibleContainers() should call GET /api/delivery-orders/{orderNumber}/eligible-containers', () => {
    service.getEligibleContainers('DO-001').subscribe();
    const req = httpMock.expectOne('/api/delivery-orders/DO-001/eligible-containers');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  // TF-06 / SSC §5.4: throughput
  it('getThroughput() should GET /api/dashboard/throughput with ISO date range + groupBy', () => {
    service.getThroughput(new Date(2026, 3, 10), new Date(2026, 3, 16)).subscribe();
    const req = httpMock.expectOne(r =>
      r.url === '/api/dashboard/throughput'
      && r.params.get('from') === '2026-04-10'
      && r.params.get('to') === '2026-04-16'
      && r.params.get('groupBy') === 'line-operator'
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  // TF-06 / SSC §5.2: stock by operator
  it('getStockByOperator() should GET /api/dashboard/stock-by-operator', () => {
    service.getStockByOperator().subscribe();
    const req = httpMock.expectOne('/api/dashboard/stock-by-operator');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  // TF-02 / EP-YBSTACK-01: tier stack state query
  it('getBlockStackState() should GET /api/yard-blocks/{id}/stack-state with bay+row params', () => {
    let result: any = null;
    service.getBlockStackState(5, 3, 2).subscribe(r => (result = r));
    const req = httpMock.expectOne(r =>
      r.url === '/api/yard-blocks/5/stack-state' && r.params.get('bay') === '3' && r.params.get('row') === '2'
    );
    expect(req.request.method).toBe('GET');
    req.flush({ bay: 3, row: 2, tiers: [{ tier: 1, occupied: true }, { tier: 2, occupied: false }] });
    expect(result.tiers.length).toBe(2);
    expect(result.tiers[0].occupied).toBeTrue();
  });

  // TF-10 / DEC-010: promote extension block to core
  it('promoteBlockToCore() should POST /api/yard-blocks/{id}/promote-core', () => {
    let result: any = null;
    service.promoteBlockToCore(42).subscribe(r => (result = r));
    const req = httpMock.expectOne('/api/yard-blocks/42/promote-core');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({ id: 42, code: 'X1', name: 'X1', blockType: 'Physical', isCore: true, isActive: true, activeContainerCount: 0 });
    expect(result.isCore).toBeTrue();
  });
});
