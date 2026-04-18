import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { YardMapService } from './yard-map.service';
import { AuthService } from './auth.service';

describe('YardMapService', () => {
  let service: YardMapService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { getToken: () => 'test-token', currentUser: () => null } },
        { provide: Router, useValue: { navigate: () => Promise.resolve(true), createUrlTree: () => ({}) } },
      ],
    });

    service = TestBed.inject(YardMapService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('GET /api/yard-map maps snapshot to overview', () => {
    let overview: any = null;
    service.getOverview().subscribe(o => (overview = o));
    const req = httpMock.expectOne('/api/yard-map');
    expect(req.request.method).toBe('GET');
    req.flush({
      generatedAt: '2026-04-18T00:00:00Z',
      revision: 'rev-1',
      blocks: [{
        id: 1, code: 'A1', name: 'A1',
        bayCount: 10, rowCount: 6, tierCount: 4,
        occupiedSlots: 3, positionedContainers: 3, unpositionedContainers: 0,
        availableSlots: 237, occupancyPercentage: 1.25,
        canvasX: 0, canvasY: 0, canvasWidth: 10, canvasHeight: 6, rotation: 0,
        category: 'Reefer', colorOverride: null, rowVersion: 'v1',
      }],
      facilities: [{ code: 'GATE', label: 'Gate', kind: 'Gate', canvasX: 0, canvasY: 14, canvasWidth: 4, canvasHeight: 2, rotation: 0 }],
    });
    expect(overview.revision).toBe('rev-1');
    expect(overview.blocks[0].category).toBe('Reefer');
    expect(overview.blocks[0].canvasWidth).toBe(10);
    expect(overview.facilities.length).toBe(1);
  });

  it('GET /api/yard-map/{code} maps block detail with slots', () => {
    let detail: any = null;
    service.getBlockDetail('A1').subscribe(d => (detail = d));
    const req = httpMock.expectOne('/api/yard-map/A1');
    req.flush({
      id: 1, code: 'A1', name: 'A1',
      bayCount: 10, rowCount: 6, tierCount: 4,
      occupiedSlots: 1, positionedContainers: 1, unpositionedContainers: 0,
      availableSlots: 239, occupancyPercentage: 0.5,
      canvasX: 0, canvasY: 0, canvasWidth: 10, canvasHeight: 6, rotation: 0, category: 'Standard',
      slots: [{
        visitId: 7, blockCode: 'A1', bay: 1, row: 1, tier: 1,
        containerNumber: 'MSCU0000001', containerType: 'DRY', containerSize: '20',
        lineOperatorCode: 'MSC', classification: 'A', condition: 'Normal',
        inboundAt: '2026-04-10T00:00:00Z', lastMovementAt: '2026-04-10T00:00:00Z', dwellDays: 2,
      }],
    });
    expect(detail.block.blockCode).toBe('A1');
    expect(detail.slots[0].visitId).toBe(7);
  });

  it('GET /api/yard-map/heatmap maps cells to occupancyPercent', () => {
    let cells: any[] = [];
    service.getHeatmap().subscribe(c => (cells = c));
    httpMock.expectOne('/api/yard-map/heatmap').flush([
      { blockCode: 'A1', bay: 1, row: 1, tier: 1, value: 50 },
    ]);
    expect(cells[0].occupancyPercent).toBe(50);
  });

  it('GET /api/yard-map/heatmap/dwell-time maps cells to dwellTimeDays', () => {
    let cells: any[] = [];
    service.getDwellHeatmap().subscribe(c => (cells = c));
    httpMock.expectOne('/api/yard-map/heatmap/dwell-time').flush([
      { blockCode: 'B1', bay: 2, row: 3, tier: 1, value: 7 },
    ]);
    expect(cells[0].dwellTimeDays).toBe(7);
  });

  it('GET /api/yard-map/layout/lock returns null on 204', () => {
    let lock: any = {};
    service.getLockStatus().subscribe(l => (lock = l));
    httpMock.expectOne('/api/yard-map/layout/lock').flush(null, { status: 204, statusText: 'No Content' });
    expect(lock).toBeNull();
  });

  it('POST /api/yard-map/layout/lock/request', () => {
    service.requestLock({ reason: 'go' }).subscribe();
    const req = httpMock.expectOne('/api/yard-map/layout/lock/request');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ reason: 'go' });
    req.flush({ id: 1, holderUserId: 'x', holderRole: 'YardPlanner', acquiredAt: '', expiresAt: '', isActive: true });
  });

  it('POST /api/yard-map/layout/lock/grant', () => {
    service.grantLock({ userId: 'abc', ttlMinutes: 10 }).subscribe();
    const req = httpMock.expectOne('/api/yard-map/layout/lock/grant');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ userId: 'abc', ttlMinutes: 10 });
    req.flush({ id: 2, holderUserId: 'abc', holderRole: 'YardPlanner', acquiredAt: '', expiresAt: '', isActive: true });
  });

  it('POST /api/yard-map/layout/lock/heartbeat', () => {
    service.heartbeat().subscribe();
    const req = httpMock.expectOne('/api/yard-map/layout/lock/heartbeat');
    expect(req.request.method).toBe('POST');
    req.flush({ id: 1, holderUserId: 'x', holderRole: 'YardPlanner', acquiredAt: '', expiresAt: '', isActive: true });
  });

  it('POST /api/yard-map/layout/lock/release', () => {
    service.releaseLock().subscribe();
    const req = httpMock.expectOne('/api/yard-map/layout/lock/release');
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });

  it('POST /api/yard-map/layout/lock/revoke', () => {
    service.revokeLock('audit').subscribe();
    const req = httpMock.expectOne('/api/yard-map/layout/lock/revoke');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ reason: 'audit' });
    req.flush(null);
  });

  it('PUT /api/yard-map/layout saves blocks', () => {
    service.saveLayout({
      blocks: [{
        yardBlockId: 1, canvasX: 0, canvasY: 0, canvasWidth: 10, canvasHeight: 6,
        rotation: 0, category: 'Standard' as any, colorOverride: null, rowVersion: 'v1',
      }],
    }).subscribe();
    const req = httpMock.expectOne('/api/yard-map/layout');
    expect(req.request.method).toBe('PUT');
    req.flush({ generatedAt: 't', revision: 'r', blocks: [], facilities: [] });
  });
});
