import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { DepotService } from '../../core/services/depot.service';
import { AuthService } from '../../core/services/auth.service';
import { DeliveryOrder, LineOperator, Customer, CreateDeliveryOrderRequest } from '../../core/models/depot.models';
import { StatusBadgeComponent, SlideOverComponent, PaginationComponent, SectionDividerComponent } from '../../core/components';

type SortKey = 'orderNumber' | 'lineOperatorName' | 'customerName' | 'orderExpiryDate';

@Component({
  selector: 'depot-order-list',
  standalone: true,
  imports: [FormsModule, RouterModule, ToastModule, StatusBadgeComponent, SlideOverComponent, PaginationComponent, SectionDividerComponent],
  providers: [MessageService],
  templateUrl: './order-list.component.html',
})
export class OrderListComponent implements OnInit {
  orders: DeliveryOrder[] = [];
  lineOperators: LineOperator[] = [];
  customers: Customer[] = [];
  loading = true;

  // Filters
  search = '';
  filterStatus = 'All';
  filterOperator = 0;
  filterDateFrom = '';
  filterDateTo = '';

  // Sort
  sortKey: SortKey = 'orderNumber';
  sortDir: 'asc' | 'desc' = 'asc';

  // Pagination
  page = 1;
  perPage = 10;

  // Detail panel
  selectedOrder: DeliveryOrder | null = null;

  // Create form
  slideOpen = false;
  saving = false;
  containerTypes = ['DRY', 'REEFER', 'OPEN_TOP', 'FLAT_RACK', 'BUNKER', 'VENTILATED', 'SPECIALIZED'];
  form = {
    orderNumber: '',
    lineOperatorId: 0,
    customerId: 0,
    orderDate: new Date().toISOString().split('T')[0],
    orderExpiryDate: '',
    outboundVessel: '',
    voyageNumber: '',
    remarks: '',
    lines: [{ containerType: 'DRY', containerSize: '20ft', isoCode: '', quantity: 1 }],
  };

  constructor(
    private depotService: DepotService,
    private messageService: MessageService,
    public authService: AuthService,
  ) {}

  ngOnInit() {
    this.loadOrders();
    this.depotService.getLineOperators().subscribe(d => this.lineOperators = d);
    this.depotService.getCustomers().subscribe(d => this.customers = d);
  }

  loadOrders() {
    this.loading = true;
    const query: any = {};
    if (this.filterStatus === 'Open') { query.isExpired = false; query.hasRemainingQuantity = true; }
    else if (this.filterStatus === 'Fulfilled') { query.hasRemainingQuantity = false; }
    else if (this.filterStatus === 'Expired') { query.isExpired = true; }

    this.depotService.getDeliveryOrders(query).subscribe({
      next: (d) => { this.orders = d; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  get filtered(): DeliveryOrder[] {
    const q = this.search.toLowerCase();
    return this.orders.filter(o => {
      const matchQ = !q || o.orderNumber.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q) || o.lineOperatorName.toLowerCase().includes(q);
      const matchOp = !this.filterOperator || o.lineOperatorId === this.filterOperator;
      let matchDate = true;
      if (this.filterDateFrom && o.orderDate) {
        matchDate = matchDate && o.orderDate >= this.filterDateFrom;
      }
      if (this.filterDateTo && o.orderDate) {
        matchDate = matchDate && o.orderDate <= this.filterDateTo;
      }
      return matchQ && matchOp && matchDate;
    });
  }

  get sorted(): DeliveryOrder[] {
    return [...this.filtered].sort((a, b) => {
      const va = (a as any)[this.sortKey] ?? '';
      const vb = (b as any)[this.sortKey] ?? '';
      const cmp = String(va).localeCompare(String(vb));
      return this.sortDir === 'asc' ? cmp : -cmp;
    });
  }

  get paginated(): DeliveryOrder[] {
    const start = (this.page - 1) * this.perPage;
    return this.sorted.slice(start, start + this.perPage);
  }

  handleSort(key: SortKey) {
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDir = 'asc';
    }
  }

  resetFilters() {
    this.search = '';
    this.filterStatus = 'All';
    this.filterOperator = 0;
    this.filterDateFrom = '';
    this.filterDateTo = '';
    this.page = 1;
    this.loadOrders();
  }

  isOrderEditable(o: DeliveryOrder): boolean {
    return !o.isExpired && !o.isFulfilled;
  }

  getOrderStatus(o: DeliveryOrder): string {
    if (o.isExpired) return 'Expired';
    if (o.isFulfilled) return 'Fulfilled';
    return 'Open';
  }

  getOrderBadgeStatus(o: DeliveryOrder): string {
    if (o.isExpired) return 'Expired';
    if (o.isFulfilled) return 'Fulfilled';
    return 'Active';
  }

  openCreate() {
    this.form = {
      orderNumber: '',
      lineOperatorId: this.lineOperators[0]?.id || 0,
      customerId: this.customers[0]?.id || 0,
      orderDate: new Date().toISOString().split('T')[0],
      orderExpiryDate: '',
      outboundVessel: '',
      voyageNumber: '',
      remarks: '',
      lines: [{ containerType: 'DRY', containerSize: '20ft', isoCode: '', quantity: 1 }],
    };
    this.slideOpen = true;
  }

  addLine() { this.form.lines.push({ containerType: 'DRY', containerSize: '20ft', isoCode: '', quantity: 1 }); }
  removeLine(i: number) { if (this.form.lines.length > 1) this.form.lines.splice(i, 1); }

  createOrder() {
    this.saving = true;
    const req: CreateDeliveryOrderRequest = {
      orderNumber: this.form.orderNumber,
      lineOperatorId: this.form.lineOperatorId,
      customerId: this.form.customerId,
      orderExpiryDate: new Date(this.form.orderExpiryDate).toISOString(),
      outboundVessel: this.form.outboundVessel,
      lines: this.form.lines.map(l => ({
        containerType: l.containerType,
        quantity: l.quantity,
      })),
    };
    this.depotService.createDeliveryOrder(req).subscribe({
      next: () => {
        this.saving = false;
        this.slideOpen = false;
        this.loadOrders();
        this.messageService.add({ severity: 'success', summary: 'Created', detail: 'Delivery order created', life: 3000 });
      },
      error: (err) => {
        this.saving = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.Message || err.error?.message || 'Create failed', life: 5000 });
      },
    });
  }
}
