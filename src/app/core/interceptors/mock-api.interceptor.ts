import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { of, delay } from 'rxjs';

/**
 * Mock API interceptor for UI-only development.
 * Returns realistic fake data so all pages render without a backend.
 *
 * To enable:  add `mockApiInterceptor` to the interceptors array in app.config.ts
 * To disable: remove it from the array (and keep only `authInterceptor`)
 */

let nextId = 1000;
const id = () => ++nextId;

// ── Seed Data ──

const lineOperators = [
  { id: 1, code: 'MAERSK', name: 'Maersk Line', email: 'ops@maersk.com', phone: '+45 3363 3363', country: 'Denmark', contactPerson: 'Lars Jensen', isActive: true },
  { id: 2, code: 'MSC', name: 'Mediterranean Shipping Company', email: 'info@msc.com', phone: '+41 22 703 8888', country: 'Switzerland', contactPerson: 'Diego Aponte', isActive: true },
  { id: 3, code: 'CMACGM', name: 'CMA CGM Group', email: 'contact@cma-cgm.com', phone: '+33 4 88 91 90 00', country: 'France', contactPerson: 'Rodolphe Saadé', isActive: true },
  { id: 4, code: 'COSCO', name: 'COSCO Shipping', email: 'service@cosco.com', phone: '+86 21 6596 6105', country: 'China', contactPerson: 'Xu Lirong', isActive: true },
  { id: 5, code: 'EVERGRN', name: 'Evergreen Marine', email: 'service@evergreen.com', phone: '+886 2 2505 7766', country: 'Taiwan', contactPerson: 'Chang Yen-I', isActive: false },
];

const customers = [
  { id: 1, taxCode: '0100000001', name: 'Công ty TNHH Logistics ABC', email: 'contact@logisticsabc.vn', phone: '028-3822-1234', address: '123 Nguyễn Huệ, Q.1, TP.HCM', contactPerson: 'Nguyễn Văn A', isActive: true },
  { id: 2, taxCode: '0200000002', name: 'Công ty CP Vận tải XYZ', email: 'info@vantaixyz.vn', phone: '028-3822-5678', address: '456 Lê Lợi, Q.1, TP.HCM', contactPerson: 'Trần Thị B', isActive: true },
  { id: 3, taxCode: '0300000003', name: 'Công ty TNHH Thương mại DEF', email: 'sales@tmdef.vn', phone: '028-3822-9012', address: '789 Hai Bà Trưng, Q.3, TP.HCM', contactPerson: 'Lê Văn C', isActive: true },
  { id: 4, taxCode: '0400000004', name: 'Công ty TNHH Xuất Nhập Khẩu GHI', email: 'export@ghi.vn', phone: '028-3833-1111', address: '101 Võ Văn Tần, Q.3, TP.HCM', contactPerson: 'Phạm Minh D', isActive: false },
];

const yardBlocks = [
  { id: 1, code: 'A1', name: 'Block A1', blockType: 'Physical', bayCount: 10, rowCount: 6, tierCount: 4, maxCapacity: 240, isActive: true, activeContainerCount: 87 },
  { id: 2, code: 'A2', name: 'Block A2', blockType: 'Physical', bayCount: 10, rowCount: 6, tierCount: 4, maxCapacity: 240, isActive: true, activeContainerCount: 210 },
  { id: 3, code: 'B1', name: 'Block B1', blockType: 'Physical', bayCount: 8, rowCount: 4, tierCount: 3, maxCapacity: 96, isActive: true, activeContainerCount: 42 },
  { id: 4, code: 'B2', name: 'Block B2', blockType: 'Physical', bayCount: 8, rowCount: 4, tierCount: 3, maxCapacity: 96, isActive: true, activeContainerCount: 91 },
  { id: 5, code: 'VIRTUAL-REPAIR', name: 'Khu sửa chữa', blockType: 'Virtual', isActive: true, activeContainerCount: 5 },
  { id: 6, code: 'VIRTUAL-INSPECT', name: 'Khu kiểm định', blockType: 'Virtual', isActive: true, activeContainerCount: 3 },
];

const containerTypes = ['DRY', 'REEFER', 'OPEN_TOP', 'FLAT_RACK'];
const prefixes = ['MSCU', 'MSKU', 'CMAU', 'CSQU', 'EGHU', 'TRLU', 'HLCU'];

function makeContainerNumber(i: number): string {
  const prefix = prefixes[i % prefixes.length];
  return `${prefix}${String(1000000 + i).slice(0, 7)}`;
}

const containers = Array.from({ length: 30 }, (_, i) => ({
  containerId: i + 1,
  containerNumber: makeContainerNumber(i),
  containerType: containerTypes[i % containerTypes.length],
  isoCode: ['22G1', '42G1', '22R1', '42P1'][i % 4],
  containerSize: i % 3 === 0 ? '40' : '20',
  containerOwner: lineOperators[i % lineOperators.length].name,
  containerCondition: i % 7 === 0 ? 'Damaged' : 'Normal',
  isInDepot: i < 18,
  currentBlockCode: i < 18 ? yardBlocks[i % 4].code : undefined,
  bay: i < 18 ? (i % 10) + 1 : undefined,
  row: i < 18 ? (i % 6) + 1 : undefined,
  tier: i < 18 ? (i % 4) + 1 : undefined,
  lineOperatorCode: i < 18 ? lineOperators[i % lineOperators.length].code : undefined,
  classification: ['A', 'A', 'B', 'A', 'C'][i % 5],
  inboundAt: i < 18 ? new Date(Date.now() - (i * 86400000)).toISOString() : undefined,
  visitStatus: i < 18 ? 'InDepot' : undefined,
}));

const containerVisitsInDepot = containers.filter(c => c.isInDepot).map((c, i) => ({
  id: i + 1,
  containerNumber: c.containerNumber,
  lineOperatorId: (i % lineOperators.length) + 1,
  lineOperatorCode: lineOperators[i % lineOperators.length].code,
  yardBlockId: (i % 4) + 1,
  yardBlockCode: yardBlocks[i % 4].code,
  bay: c.bay,
  row: c.row,
  tier: c.tier,
  classification: c.classification,
  condition: c.containerCondition,
  inboundVehicle: `TRUCK-IN-${String(i + 1).padStart(3, '0')}`,
  inboundAt: c.inboundAt,
  status: 'InDepot',
  lastMovementAt: c.inboundAt,
}));

const containerVisitsReleased = Array.from({ length: 5 }, (_, i) => ({
  id: 100 + i,
  containerNumber: makeContainerNumber(20 + i),
  lineOperatorId: 1,
  lineOperatorCode: 'MAERSK',
  yardBlockId: 1,
  yardBlockCode: 'A1',
  bay: i + 1,
  row: 1,
  tier: 1,
  classification: 'A',
  condition: 'Normal',
  inboundVehicle: `TRUCK-IN-${100 + i}`,
  outboundVehicle: `TRUCK-OUT-${100 + i}`,
  inboundAt: new Date(Date.now() - 7 * 86400000).toISOString(),
  outboundAt: new Date(Date.now() - 86400000).toISOString(),
  status: 'Released',
  deliveryOrderNumber: 'DO-2026-0001',
  lastMovementAt: new Date(Date.now() - 86400000).toISOString(),
}));

const deliveryOrders = [
  {
    id: 1, lineOperatorId: 1, lineOperatorCode: 'MAERSK', lineOperatorName: 'Maersk Line',
    customerId: 1, customerTaxCode: '0100000001', customerName: 'Công ty TNHH Logistics ABC',
    orderNumber: 'DO-2026-0001', orderDate: '2026-04-10', orderExpiryDate: '2026-04-25',
    outboundVessel: 'MAERSK SEALAND', voyageNumber: 'V2026-042', remarks: 'Priority shipment',
    isExpired: false, hasRemainingQuantity: true, isFulfilled: false,
    totalRequestedQuantity: 10, totalReleasedQuantity: 5, totalRemainingQuantity: 5,
    lines: [
      { id: 1, containerType: 'DRY', containerSize: '20', isoCode: '22G1', quantity: 6, releasedQuantity: 3, remainingQuantity: 3, availableInDepotQuantity: 8, canBeFulfilledFromDepotStock: true },
      { id: 2, containerType: 'REEFER', containerSize: '40', isoCode: '42R1', quantity: 4, releasedQuantity: 2, remainingQuantity: 2, availableInDepotQuantity: 3, canBeFulfilledFromDepotStock: true },
    ],
  },
  {
    id: 2, lineOperatorId: 2, lineOperatorCode: 'MSC', lineOperatorName: 'Mediterranean Shipping Company',
    customerId: 2, customerTaxCode: '0200000002', customerName: 'Công ty CP Vận tải XYZ',
    orderNumber: 'DO-2026-0002', orderDate: '2026-04-12', orderExpiryDate: '2026-04-20',
    outboundVessel: 'MSC OSCAR', voyageNumber: 'V2026-051',
    isExpired: false, hasRemainingQuantity: true, isFulfilled: false,
    totalRequestedQuantity: 5, totalReleasedQuantity: 0, totalRemainingQuantity: 5,
    lines: [
      { id: 3, containerType: 'DRY', containerSize: '40', isoCode: '42G1', quantity: 5, releasedQuantity: 0, remainingQuantity: 5, availableInDepotQuantity: 8, canBeFulfilledFromDepotStock: true },
    ],
  },
  {
    id: 3, lineOperatorId: 1, lineOperatorCode: 'MAERSK', lineOperatorName: 'Maersk Line',
    customerId: 3, customerTaxCode: '0300000003', customerName: 'Công ty TNHH Thương mại DEF',
    orderNumber: 'DO-2026-0003', orderDate: '2026-03-01', orderExpiryDate: '2026-03-15',
    outboundVessel: 'MAERSK ELBA',
    isExpired: true, hasRemainingQuantity: true, isFulfilled: false,
    totalRequestedQuantity: 8, totalReleasedQuantity: 2, totalRemainingQuantity: 6,
    lines: [
      { id: 4, containerType: 'OPEN_TOP', containerSize: '20', isoCode: '22U1', quantity: 8, releasedQuantity: 2, remainingQuantity: 6, availableInDepotQuantity: 1, canBeFulfilledFromDepotStock: false },
    ],
  },
  {
    id: 4, lineOperatorId: 3, lineOperatorCode: 'CMACGM', lineOperatorName: 'CMA CGM Group',
    customerId: 1, customerTaxCode: '0100000001', customerName: 'Công ty TNHH Logistics ABC',
    orderNumber: 'DO-2026-0004', orderDate: '2026-04-01', orderExpiryDate: '2026-04-10',
    outboundVessel: 'CMA CGM MARCO POLO',
    isExpired: false, hasRemainingQuantity: false, isFulfilled: true,
    totalRequestedQuantity: 3, totalReleasedQuantity: 3, totalRemainingQuantity: 0,
    lines: [
      { id: 5, containerType: 'DRY', containerSize: '20', isoCode: '22G1', quantity: 3, releasedQuantity: 3, remainingQuantity: 0, availableInDepotQuantity: 8, canBeFulfilledFromDepotStock: true },
    ],
  },
];

const eligibleContainers = containers.filter(c => c.isInDepot).slice(0, 6).map(c => ({
  containerId: c.containerId,
  containerNumber: c.containerNumber,
  containerType: c.containerType,
  lineOperatorCode: c.lineOperatorCode!,
  yardBlockCode: c.currentBlockCode!,
  bay: c.bay,
  row: c.row,
  tier: c.tier,
  classification: c.classification,
  condition: c.containerCondition,
  inboundAt: c.inboundAt!,
}));

const dashboard = {
  totalBlocks: yardBlocks.length,
  totalContainers: containers.length,
  activeVisits: containerVisitsInDepot.length,
  activeDeliveryOrders: deliveryOrders.filter(o => !o.isExpired && !o.isFulfilled).length,
  todayGateIn: 4,
  todayGateOut: 2,
  yardOccupancyPercent: 65,
  blockOccupancies: yardBlocks.filter(b => b.blockType === 'Physical').map(b => ({
    blockCode: b.code,
    blockName: b.name,
    activeContainers: b.activeContainerCount,
    maxCapacity: b.maxCapacity!,
  })),
  recentActivity: [
    { time: new Date(Date.now() - 300000).toISOString(), containerNumber: 'MSCU1000000', action: 'Gate-In', blockCode: 'A1', operatorName: 'Maersk Line' },
    { time: new Date(Date.now() - 900000).toISOString(), containerNumber: 'MSKU1000001', action: 'Gate-Out', blockCode: 'A2', operatorName: 'MSC' },
    { time: new Date(Date.now() - 1800000).toISOString(), containerNumber: 'CMAU1000002', action: 'Relocated', blockCode: 'B1', operatorName: 'CMA CGM' },
    { time: new Date(Date.now() - 3600000).toISOString(), containerNumber: 'CSQU1000003', action: 'Gate-In', blockCode: 'B2', operatorName: 'COSCO' },
    { time: new Date(Date.now() - 5400000).toISOString(), containerNumber: 'EGHU1000004', action: 'Gate-Out', blockCode: 'A1', operatorName: 'Evergreen' },
    { time: new Date(Date.now() - 7200000).toISOString(), containerNumber: 'TRLU1000005', action: 'Gate-In', blockCode: 'A2', operatorName: 'Maersk Line' },
    { time: new Date(Date.now() - 9000000).toISOString(), containerNumber: 'HLCU1000006', action: 'Relocated', blockCode: 'B1', operatorName: 'MSC' },
    { time: new Date(Date.now() - 10800000).toISOString(), containerNumber: 'MSCU1000007', action: 'Gate-In', blockCode: 'A1', operatorName: 'CMA CGM' },
  ],
  expiringSoonOrders: [
    { orderNumber: 'DO-2026-0002', operatorName: 'Mediterranean Shipping Company', expiryDate: '2026-04-20', remainingContainers: 5 },
  ],
};

// ── Route Matcher ──

function matchUrl(url: string, method: string): HttpResponse<unknown> | null {
  // Remove query string for matching
  const [path] = url.split('?');

  // Dashboard
  if (path === '/api/dashboard' && method === 'GET') {
    return json(dashboard);
  }

  // Line Operators
  if (path === '/api/line-operators' && method === 'GET') return json(lineOperators);
  if (path === '/api/line-operators' && method === 'POST') return json({ ...lineOperators[0], id: id() });
  if (path.match(/^\/api\/line-operators\/\d+$/) && method === 'PUT') return json(lineOperators[0]);

  // Customers
  if (path === '/api/customers' && method === 'GET') return json(customers);
  if (path === '/api/customers' && method === 'POST') return json({ ...customers[0], id: id() });
  if (path.match(/^\/api\/customers\/\d+$/) && method === 'PUT') return json(customers[0]);

  // Yard Blocks
  if (path === '/api/yard-blocks' && method === 'GET') return json(yardBlocks);
  if (path.match(/^\/api\/yard-blocks\/\d+$/) && method === 'GET') return json(yardBlocks[0]);
  if (path === '/api/yard-blocks' && method === 'POST') return json({ ...yardBlocks[0], id: id() });
  if (path.match(/^\/api\/yard-blocks\/\d+$/) && method === 'PUT') return json(yardBlocks[0]);
  if (path.match(/^\/api\/yard-blocks\/\d+$/) && method === 'DELETE') return json(null);

  // Containers
  if (path === '/api/containers' && method === 'GET') return json(containers);
  if (path.match(/^\/api\/containers\/by-number\/.+$/) && method === 'GET') {
    return new HttpResponse({ status: 404, body: null });
  }
  if (path.match(/^\/api\/containers\/\d+$/) && method === 'GET') return json(containers[0]);
  if (path === '/api/containers' && method === 'POST') return json({ ...containers[0], id: id() });
  if (path.match(/^\/api\/containers\/\d+$/) && method === 'PUT') return json(containers[0]);
  if (path.match(/^\/api\/containers\/\d+$/) && method === 'DELETE') return json(null);
  if (path.match(/^\/api\/containers\/.+\/current-location$/)) {
    const num = path.split('/')[3];
    const c = containers.find(x => x.containerNumber === num);
    return json({
      containerNumber: num,
      isInDepot: c?.isInDepot ?? false,
      visitStatus: c?.visitStatus,
      yardBlockCode: c?.currentBlockCode,
      bay: c?.bay, row: c?.row, tier: c?.tier,
      lineOperatorCode: c?.lineOperatorCode,
      classification: c?.classification,
      condition: c?.containerCondition,
      inboundAt: c?.inboundAt,
    });
  }
  if (path.match(/^\/api\/containers\/.+\/visit-history$/)) {
    return json([{
      visitId: 1, containerNumber: path.split('/')[3], lineOperatorCode: 'MAERSK',
      inboundAt: new Date(Date.now() - 5 * 86400000).toISOString(), status: 'InDepot',
      movements: [
        { id: 1, movementType: 'Inbound', movementAt: new Date(Date.now() - 5 * 86400000).toISOString(), yardBlockId: 1, yardBlockCode: 'A1', bay: 1, row: 1, tier: 1, vehicle: 'TRUCK-IN-001' },
        { id: 2, movementType: 'Relocated', movementAt: new Date(Date.now() - 3 * 86400000).toISOString(), yardBlockId: 2, yardBlockCode: 'A2', bay: 2, row: 2, tier: 1, note: 'Optimizing space' },
      ],
    }]);
  }

  // Container Visits
  if (path === '/api/container-visits' && method === 'GET') {
    const statusParam = new URL(url, 'http://localhost').searchParams.get('status');
    if (statusParam === 'Released') return json(containerVisitsReleased);
    if (statusParam === 'InDepot') return json(containerVisitsInDepot);
    return json([...containerVisitsInDepot, ...containerVisitsReleased]);
  }
  if (path.match(/^\/api\/container-visits\/\d+$/) && method === 'GET') return json(containerVisitsInDepot[0]);
  if (path.match(/^\/api\/container-visits\/\d+\/movements$/)) {
    return json([
      { id: 1, movementType: 'Inbound', movementAt: new Date(Date.now() - 5 * 86400000).toISOString(), yardBlockId: 1, yardBlockCode: 'A1', bay: 1, row: 1, tier: 1, vehicle: 'TRUCK-IN-001' },
      { id: 2, movementType: 'Relocated', movementAt: new Date(Date.now() - 2 * 86400000).toISOString(), yardBlockId: 3, yardBlockCode: 'B1', bay: 3, row: 2, tier: 1, note: 'Yard optimization' },
    ]);
  }
  if (path === '/api/container-visits/gate-in' && method === 'POST') {
    return json({
      id: id(), containerNumber: 'MSCU1234567', lineOperatorId: 1, lineOperatorCode: 'MAERSK',
      yardBlockId: 1, yardBlockCode: 'A1', bay: 5, row: 3, tier: 2, classification: 'A', condition: 'Normal',
      inboundVehicle: 'TRUCK-IN-NEW', inboundAt: new Date().toISOString(), status: 'InDepot', lastMovementAt: new Date().toISOString(),
    });
  }
  if (path === '/api/container-visits/gate-out' && method === 'POST') {
    return json({
      id: id(), containerNumber: 'MSCU1000000', lineOperatorId: 1, lineOperatorCode: 'MAERSK',
      yardBlockId: 1, yardBlockCode: 'A1', classification: 'A', condition: 'Normal',
      inboundVehicle: 'TRUCK-IN-001', outboundVehicle: 'TRUCK-OUT-NEW',
      inboundAt: new Date(Date.now() - 86400000).toISOString(), outboundAt: new Date().toISOString(),
      status: 'Released', lastMovementAt: new Date().toISOString(),
    });
  }
  if (path === '/api/container-visits/relocate' && method === 'POST') {
    return json({
      id: id(), containerNumber: 'MSCU1000000', lineOperatorId: 1, lineOperatorCode: 'MAERSK',
      yardBlockId: 3, yardBlockCode: 'B1', bay: 1, row: 1, tier: 1, classification: 'A', condition: 'Normal',
      inboundVehicle: 'TRUCK-IN-001', inboundAt: new Date(Date.now() - 86400000).toISOString(),
      status: 'InDepot', lastMovementAt: new Date().toISOString(),
    });
  }

  // Delivery Orders
  if (path === '/api/delivery-orders' && method === 'GET') return json(deliveryOrders);
  if (path === '/api/delivery-orders' && method === 'POST') return json({ ...deliveryOrders[0], id: id() });
  if (path.match(/^\/api\/delivery-orders\/[^/]+\/eligible-containers$/)) return json(eligibleContainers);
  if (path.match(/^\/api\/delivery-orders\/[^/]+$/) && method === 'GET') {
    const orderNum = path.split('/')[3];
    return json(deliveryOrders.find(o => o.orderNumber === orderNum) ?? deliveryOrders[0]);
  }

  return null;
}

function json(body: unknown): HttpResponse<unknown> {
  return new HttpResponse({ status: 200, body });
}

// ── The Interceptor ──

export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api')) {
    return next(req);
  }

  const response = matchUrl(req.url, req.method);
  if (response) {
    // Simulate network latency (150-400ms)
    const latency = 150 + Math.floor(Math.random() * 250);
    return of(response).pipe(delay(latency));
  }

  // Fallback: let it through (will 404 if no backend)
  return next(req);
};
