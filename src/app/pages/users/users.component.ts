import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { UsersService } from '../../core/services/users.service';
import { AuthService } from '../../core/services/auth.service';
import { UserListItem, DepotRole } from '../../core/models/user.models';
import { SlideOverComponent, PaginationComponent, StatusBadgeComponent, ConfirmDialogComponent } from '../../core/components';

type SortKey = 'userName' | 'fullName' | 'role' | 'lastLoginAt';

const ROLES: DepotRole[] = ['Manager', 'YardPlanner', 'GateOperator', 'OrderClerk'];

const ROLE_LABELS: Record<DepotRole, string> = {
  Manager: 'Manager',
  YardPlanner: 'Yard Planner',
  GateOperator: 'Gate Operator',
  OrderClerk: 'Order Clerk',
};

const ROLE_BADGE: Record<DepotRole, string> = {
  Manager: 'bg-[#D9EDF7] text-[#0275D8]',
  GateOperator: 'bg-[#DFF0D8] text-[#3C763D]',
  YardPlanner: 'bg-[#FCF8E3] text-[#8A6D3B]',
  OrderClerk: 'bg-[#F5F5F5] text-[#555]',
};

@Component({
  selector: 'depot-users',
  standalone: true,
  imports: [FormsModule, ToastModule, SlideOverComponent, PaginationComponent, StatusBadgeComponent, ConfirmDialogComponent],
  providers: [MessageService],
  templateUrl: './users.component.html',
})
export class UsersComponent implements OnInit {
  readonly roles = ROLES;
  readonly roleLabel = (r: DepotRole) => ROLE_LABELS[r];
  readonly roleBadge = (r: DepotRole) => ROLE_BADGE[r];

  data: UserListItem[] = [];
  loading = true;

  search = '';
  roleFilter: 'All' | DepotRole = 'All';
  statusFilter: 'All' | 'Active' | 'Inactive' = 'All';

  sortKey: SortKey = 'userName';
  sortDir: 'asc' | 'desc' = 'asc';

  page = 1;
  perPage = 10;

  // Create/Edit slide-over
  slideOpen = false;
  editMode = false;
  editId = '';
  saving = false;
  form = {
    userName: '',
    email: '',
    fullName: '',
    role: 'GateOperator' as DepotRole,
    password: '',
    confirmPassword: '',
  };

  // Change Role modal
  roleModalOpen = false;
  roleModalUser: UserListItem | null = null;
  roleModalSelection: DepotRole = 'GateOperator';
  roleModalSaving = false;

  // Reset password modal
  resetPwdOpen = false;
  resetPwdUser: UserListItem | null = null;
  resetPwdForm = { newPassword: '', confirmPassword: '' };
  resetPwdSaving = false;

  // Deactivate confirm
  confirmOpen = false;
  confirmTitle = '';
  confirmMessage = '';
  pendingAction: (() => void) | null = null;

  // Kebab menu
  openMenuId = '';

  constructor(
    private usersService: UsersService,
    private messageService: MessageService,
    public authService: AuthService,
  ) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.usersService.getUsers().subscribe({
      next: (d) => { this.data = d; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  get filtered(): UserListItem[] {
    const q = this.search.toLowerCase();
    return this.data.filter(u => {
      const matchQ = !q
        || u.userName.toLowerCase().includes(q)
        || u.fullName.toLowerCase().includes(q)
        || u.email.toLowerCase().includes(q);
      const matchRole = this.roleFilter === 'All' || u.role === this.roleFilter;
      const matchStatus = this.statusFilter === 'All'
        || (this.statusFilter === 'Active' && u.isActive)
        || (this.statusFilter === 'Inactive' && !u.isActive);
      return matchQ && matchRole && matchStatus;
    });
  }

  get sorted(): UserListItem[] {
    return [...this.filtered].sort((a, b) => {
      const va = (a as any)[this.sortKey] ?? '';
      const vb = (b as any)[this.sortKey] ?? '';
      const cmp = String(va).localeCompare(String(vb));
      return this.sortDir === 'asc' ? cmp : -cmp;
    });
  }

  get paginated(): UserListItem[] {
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

  formatLastLogin(v?: string): string {
    if (!v) return '—';
    const d = new Date(v);
    if (isNaN(d.getTime())) return '—';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  isSelf(u: UserListItem): boolean {
    return u.id === this.authService.currentUser()?.id;
  }

  // ── Create / Edit ──
  openCreate() {
    this.editMode = false;
    this.editId = '';
    this.form = { userName: '', email: '', fullName: '', role: 'GateOperator', password: '', confirmPassword: '' };
    this.slideOpen = true;
  }

  openEdit(u: UserListItem) {
    this.editMode = true;
    this.editId = u.id;
    this.form = {
      userName: u.userName,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      password: '',
      confirmPassword: '',
    };
    this.slideOpen = true;
    this.openMenuId = '';
  }

  canSave(): boolean {
    if (!this.form.email || !this.form.fullName) return false;
    if (this.editMode) return true;
    if (!this.form.userName || !this.form.password) return false;
    if (this.form.password.length < 6) return false;
    if (this.form.password !== this.form.confirmPassword) return false;
    return true;
  }

  save() {
    if (!this.canSave()) return;
    this.saving = true;

    if (this.editMode) {
      this.usersService.updateUser(this.editId, {
        fullName: this.form.fullName,
        email: this.form.email,
      }).subscribe({
        next: () => {
          this.saving = false;
          this.slideOpen = false;
          this.load();
          this.messageService.add({
            severity: 'success', summary: 'Updated',
            detail: `User ${this.form.userName} updated`, life: 3000,
          });
        },
        error: (err) => this.handleError(err, 'Update failed'),
      });
    } else {
      this.usersService.register({
        userName: this.form.userName,
        email: this.form.email,
        fullName: this.form.fullName,
        password: this.form.password,
        role: this.form.role,
      }).subscribe({
        next: () => {
          this.saving = false;
          this.slideOpen = false;
          this.load();
          this.messageService.add({
            severity: 'success', summary: 'Created',
            detail: `User ${this.form.userName} created`, life: 3000,
          });
        },
        error: (err) => this.handleError(err, 'Create failed'),
      });
    }
  }

  // ── Change Role ──
  openChangeRole(u: UserListItem) {
    this.roleModalUser = u;
    this.roleModalSelection = u.role;
    this.roleModalOpen = true;
    this.openMenuId = '';
  }

  saveRole() {
    if (!this.roleModalUser) return;
    if (this.roleModalSelection === this.roleModalUser.role) {
      this.roleModalOpen = false;
      return;
    }
    this.roleModalSaving = true;
    const user = this.roleModalUser;
    this.usersService.changeRole(user.id, { role: this.roleModalSelection }).subscribe({
      next: () => {
        this.roleModalSaving = false;
        this.roleModalOpen = false;
        this.load();
        this.messageService.add({
          severity: 'success', summary: 'Role Changed',
          detail: `${user.userName} is now ${ROLE_LABELS[this.roleModalSelection]}`, life: 3000,
        });
      },
      error: (err) => { this.roleModalSaving = false; this.handleError(err, 'Role change failed'); },
    });
  }

  // ── Reset Password ──
  openResetPassword(u: UserListItem) {
    this.resetPwdUser = u;
    this.resetPwdForm = { newPassword: '', confirmPassword: '' };
    this.resetPwdOpen = true;
    this.openMenuId = '';
  }

  canResetPassword(): boolean {
    return this.resetPwdForm.newPassword.length >= 6
      && this.resetPwdForm.newPassword === this.resetPwdForm.confirmPassword;
  }

  saveResetPassword() {
    if (!this.resetPwdUser || !this.canResetPassword()) return;
    this.resetPwdSaving = true;
    const user = this.resetPwdUser;
    this.usersService.resetPassword(user.id, { newPassword: this.resetPwdForm.newPassword }).subscribe({
      next: () => {
        this.resetPwdSaving = false;
        this.resetPwdOpen = false;
        this.messageService.add({
          severity: 'success', summary: 'Password Reset',
          detail: `${user.userName}'s password has been reset`, life: 3000,
        });
      },
      error: (err) => { this.resetPwdSaving = false; this.handleError(err, 'Reset failed'); },
    });
  }

  // ── Activate / Deactivate ──
  deactivate(u: UserListItem) {
    this.openMenuId = '';
    this.confirmTitle = 'Deactivate User';
    this.confirmMessage = `Are you sure you want to deactivate "${u.fullName}" (${u.userName})? Their active sessions will be revoked.`;
    this.pendingAction = () => {
      this.usersService.deactivate(u.id).subscribe({
        next: () => {
          this.load();
          this.messageService.add({
            severity: 'success', summary: 'Deactivated',
            detail: `${u.userName} deactivated`, life: 3000,
          });
        },
        error: (err) => this.handleError(err, 'Deactivate failed'),
      });
    };
    this.confirmOpen = true;
  }

  activate(u: UserListItem) {
    this.openMenuId = '';
    this.usersService.activate(u.id).subscribe({
      next: () => {
        this.load();
        this.messageService.add({
          severity: 'success', summary: 'Activated',
          detail: `${u.userName} activated`, life: 3000,
        });
      },
      error: (err) => this.handleError(err, 'Activate failed'),
    });
  }

  onConfirm() {
    this.confirmOpen = false;
    this.pendingAction?.();
    this.pendingAction = null;
  }

  onCancelConfirm() {
    this.confirmOpen = false;
    this.pendingAction = null;
  }

  toggleMenu(id: string, event: Event) {
    event.stopPropagation();
    this.openMenuId = this.openMenuId === id ? '' : id;
  }

  resetFilters() {
    this.search = '';
    this.roleFilter = 'All';
    this.statusFilter = 'All';
    this.page = 1;
  }

  private handleError(err: any, fallback: string) {
    this.saving = false;
    this.messageService.add({
      severity: 'error', summary: 'Error',
      detail: err.error?.Message || err.error?.message || fallback, life: 5000,
    });
  }
}
