import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { DepotService } from '../../core/services/depot.service';
import { AuthService } from '../../core/services/auth.service';
import { Customer } from '../../core/models/depot.models';
import {
  PaginationComponent,
  SlideOverComponent,
  ConfirmDialogComponent,
} from '../../core/components';

type SortKey = 'taxCode' | 'name';

interface CustomerForm {
  id?: number;
  taxCode: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  contactPerson: string;
}

const EMPTY_FORM: CustomerForm = {
  taxCode: '',
  name: '',
  email: '',
  phone: '',
  address: '',
  contactPerson: '',
};

@Component({
  selector: 'depot-customers',
  standalone: true,
  imports: [FormsModule, ToastModule, PaginationComponent, SlideOverComponent, ConfirmDialogComponent],
  providers: [MessageService],
  templateUrl: './customers.component.html',
})
export class CustomersComponent implements OnInit {
  private readonly depotService = inject(DepotService);
  private readonly messageService = inject(MessageService);
  readonly authService = inject(AuthService);

  data: Customer[] = [];
  loading = true;
  search = '';
  sortKey: SortKey = 'taxCode';
  sortDir: 'asc' | 'desc' = 'asc';
  page = 1;
  perPage = 10;

  // Create / edit slide-over.
  slideOpen = false;
  saving = false;
  form: CustomerForm = { ...EMPTY_FORM };

  // Delete confirm.
  deleteTarget: Customer | null = null;

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this.depotService.getCustomers().subscribe({
      next: (data) => {
        this.data = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  get filtered(): Customer[] {
    const query = this.search.trim().toLowerCase();
    return this.data.filter(customer => !query
      || customer.taxCode.toLowerCase().includes(query)
      || customer.name.toLowerCase().includes(query));
  }

  get sorted(): Customer[] {
    return [...this.filtered].sort((left, right) => {
      const a = String(left[this.sortKey] ?? '');
      const b = String(right[this.sortKey] ?? '');
      const result = a.localeCompare(b);
      return this.sortDir === 'asc' ? result : -result;
    });
  }

  get paginated(): Customer[] {
    const start = (this.page - 1) * this.perPage;
    return this.sorted.slice(start, start + this.perPage);
  }

  handleSort(key: SortKey) {
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
      return;
    }
    this.sortKey = key;
    this.sortDir = 'asc';
  }

  openCreate() {
    if (!this.authService.canManageOrders()) return;
    this.form = { ...EMPTY_FORM };
    this.slideOpen = true;
  }

  openEdit(c: Customer) {
    if (!this.authService.canManageOrders()) return;
    this.form = {
      id: c.id,
      taxCode: c.taxCode,
      name: c.name,
      email: c.email ?? '',
      phone: c.phone ?? '',
      address: c.address ?? '',
      contactPerson: c.contactPerson ?? '',
    };
    this.slideOpen = true;
  }

  get formInvalid(): boolean {
    return !this.form.taxCode.trim() || !this.form.name.trim();
  }

  save() {
    if (this.formInvalid || this.saving) return;
    this.saving = true;
    const payload: Partial<Customer> = {
      taxCode: this.form.taxCode.trim(),
      name: this.form.name.trim(),
      email: this.form.email.trim() || undefined,
      phone: this.form.phone.trim() || undefined,
      address: this.form.address.trim() || undefined,
      contactPerson: this.form.contactPerson.trim() || undefined,
    };
    const obs$ = this.form.id
      ? this.depotService.updateCustomer(this.form.id, payload)
      : this.depotService.createCustomer(payload);
    obs$.subscribe({
      next: () => {
        this.saving = false;
        this.slideOpen = false;
        this.messageService.add({
          severity: 'success',
          summary: this.form.id ? 'Updated' : 'Created',
          detail: `Customer ${payload.name} đã lưu.`,
          life: 3000,
        });
        this.load();
      },
      error: (err) => {
        this.saving = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Lỗi lưu',
          detail: err.error?.Message || err.error?.message || 'Không thể lưu customer.',
          life: 5000,
        });
      },
    });
  }

  askDelete(c: Customer) {
    if (!this.authService.canManageOrders()) return;
    this.deleteTarget = c;
  }

  confirmDelete() {
    const target = this.deleteTarget;
    if (!target) return;
    this.depotService.deleteCustomer(target.id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Deleted',
          detail: `Customer ${target.name} đã xoá.`,
          life: 3000,
        });
        this.deleteTarget = null;
        this.load();
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Lỗi xoá',
          detail: err.error?.Message || err.error?.message || 'Không thể xoá customer (có thể đang được tham chiếu bởi Delivery Order).',
          life: 5000,
        });
        this.deleteTarget = null;
      },
    });
  }

  cancelDelete() {
    this.deleteTarget = null;
  }
}
