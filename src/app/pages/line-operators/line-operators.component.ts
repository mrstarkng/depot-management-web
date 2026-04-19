import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { DepotService } from '../../core/services/depot.service';
import { AuthService } from '../../core/services/auth.service';
import { LineOperator } from '../../core/models/depot.models';
import {
  PaginationComponent,
  SlideOverComponent,
  ConfirmDialogComponent,
} from '../../core/components';

type SortKey = 'code' | 'name';

interface LineOperatorForm {
  id?: number;
  code: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  contactPerson: string;
  country: string;
}

const EMPTY_FORM: LineOperatorForm = {
  code: '',
  name: '',
  email: '',
  phone: '',
  address: '',
  contactPerson: '',
  country: '',
};

@Component({
  selector: 'depot-line-operators',
  standalone: true,
  imports: [FormsModule, ToastModule, PaginationComponent, SlideOverComponent, ConfirmDialogComponent],
  providers: [MessageService],
  templateUrl: './line-operators.component.html',
})
export class LineOperatorsComponent implements OnInit {
  private readonly depotService = inject(DepotService);
  private readonly messageService = inject(MessageService);
  readonly authService = inject(AuthService);

  data: LineOperator[] = [];
  loading = true;
  search = '';
  sortKey: SortKey = 'code';
  sortDir: 'asc' | 'desc' = 'asc';
  page = 1;
  perPage = 10;

  slideOpen = false;
  saving = false;
  form: LineOperatorForm = { ...EMPTY_FORM };

  deleteTarget: LineOperator | null = null;

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this.depotService.getLineOperators().subscribe({
      next: (data) => {
        this.data = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  get filtered(): LineOperator[] {
    const query = this.search.trim().toLowerCase();
    return this.data.filter(operator => !query
      || operator.code.toLowerCase().includes(query)
      || operator.name.toLowerCase().includes(query));
  }

  get sorted(): LineOperator[] {
    return [...this.filtered].sort((left, right) => {
      const a = String(left[this.sortKey] ?? '');
      const b = String(right[this.sortKey] ?? '');
      const result = a.localeCompare(b);
      return this.sortDir === 'asc' ? result : -result;
    });
  }

  get paginated(): LineOperator[] {
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

  openEdit(op: LineOperator) {
    if (!this.authService.canManageOrders()) return;
    this.form = {
      id: op.id,
      code: op.code,
      name: op.name,
      email: op.email ?? '',
      phone: op.phone ?? '',
      address: op.address ?? '',
      contactPerson: op.contactPerson ?? '',
      country: op.country ?? '',
    };
    this.slideOpen = true;
  }

  get formInvalid(): boolean {
    return !this.form.code.trim() || !this.form.name.trim();
  }

  save() {
    if (this.formInvalid || this.saving) return;
    this.saving = true;
    const payload: Partial<LineOperator> = {
      code: this.form.code.trim(),
      name: this.form.name.trim(),
      email: this.form.email.trim() || undefined,
      phone: this.form.phone.trim() || undefined,
      address: this.form.address.trim() || undefined,
      contactPerson: this.form.contactPerson.trim() || undefined,
      country: this.form.country.trim() || undefined,
    };
    const obs$ = this.form.id
      ? this.depotService.updateLineOperator(this.form.id, payload)
      : this.depotService.createLineOperator(payload);
    obs$.subscribe({
      next: () => {
        this.saving = false;
        this.slideOpen = false;
        this.messageService.add({
          severity: 'success',
          summary: this.form.id ? 'Updated' : 'Created',
          detail: `Line Operator ${payload.name} đã lưu.`,
          life: 3000,
        });
        this.load();
      },
      error: (err) => {
        this.saving = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Lỗi lưu',
          detail: err.error?.Message || err.error?.message || 'Không thể lưu line operator.',
          life: 5000,
        });
      },
    });
  }

  askDelete(op: LineOperator) {
    if (!this.authService.canManageOrders()) return;
    this.deleteTarget = op;
  }

  confirmDelete() {
    const target = this.deleteTarget;
    if (!target) return;
    this.depotService.deleteLineOperator(target.id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Deleted',
          detail: `Line Operator ${target.name} đã xoá.`,
          life: 3000,
        });
        this.deleteTarget = null;
        this.load();
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Lỗi xoá',
          detail: err.error?.Message || err.error?.message || 'Không thể xoá operator (có thể đang được tham chiếu bởi Delivery Order hoặc Container).',
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
