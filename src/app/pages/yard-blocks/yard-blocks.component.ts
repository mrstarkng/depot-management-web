import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { DepotService } from '../../core/services/depot.service';
import { AuthService } from '../../core/services/auth.service';
import { YardBlock, CreateYardBlockRequest, YardBlockType, YardBlockCategory } from '../../core/models/depot.models';
import { StatusBadgeComponent, SlideOverComponent, PaginationComponent, SectionDividerComponent, ConfirmDialogComponent } from '../../core/components';

type SortKey = 'code' | 'blockType' | 'bayCount' | 'rowCount' | 'tierCount' | 'activeContainerCount';

@Component({
  selector: 'depot-yard-blocks',
  standalone: true,
  imports: [FormsModule, ToastModule, StatusBadgeComponent, SlideOverComponent, PaginationComponent, SectionDividerComponent, ConfirmDialogComponent],
  providers: [MessageService],
  templateUrl: './yard-blocks.component.html',
})
export class YardBlocksComponent implements OnInit {
  data: YardBlock[] = [];
  loading = true;

  // Filters
  search = '';
  filterType = 'All';
  filterStatus = 'All';

  // Sort
  sortKey: SortKey = 'code';
  sortDir: 'asc' | 'desc' = 'asc';

  // Pagination
  page = 1;
  perPage = 10;

  // Form
  slideOpen = false;
  editMode = false;
  editId = 0;
  saving = false;
  form: CreateYardBlockRequest = { code: '', name: '', blockType: YardBlockType.Physical, category: YardBlockCategory.Standard };

  readonly allCategories = Object.values(YardBlockCategory);

  // Menu
  openMenuId: number | null = null;

  constructor(
    private depotService: DepotService,
    private messageService: MessageService,
    public authService: AuthService,
  ) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.depotService.getYardBlocks().subscribe({
      next: (d) => { this.data = d; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  // Confirm dialog
  confirmOpen = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmVariant: 'danger' | 'warning' = 'danger';
  pendingAction: (() => void) | null = null;

  get filtered(): YardBlock[] {
    return this.data.filter(b => {
      const q = this.search.toLowerCase();
      const matchQ = !q || b.code.toLowerCase().includes(q) || (b.name?.toLowerCase().includes(q) ?? false);
      const matchType = this.filterType === 'All' || b.blockType === this.filterType;
      const matchStatus = this.filterStatus === 'All' ||
        (this.filterStatus === 'Active' && b.isActive) ||
        (this.filterStatus === 'Inactive' && !b.isActive);
      return matchQ && matchType && matchStatus;
    });
  }

  get sorted(): YardBlock[] {
    return [...this.filtered].sort((a, b) => {
      const va = (a as any)[this.sortKey] ?? '';
      const vb = (b as any)[this.sortKey] ?? '';
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return this.sortDir === 'asc' ? cmp : -cmp;
    });
  }

  get paginated(): YardBlock[] {
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

  resetFilter() {
    this.search = '';
    this.filterType = 'All';
    this.filterStatus = 'All';
    this.page = 1;
  }

  openCreate() {
    this.form = { code: '', name: '', blockType: YardBlockType.Physical, category: YardBlockCategory.Standard };
    this.editMode = false;
    this.editId = 0;
    this.slideOpen = true;
  }

  openEdit(block: YardBlock) {
    this.form = {
      code: block.code,
      name: block.name,
      blockType: block.blockType as YardBlockType,
      category: (block as any).category ?? YardBlockCategory.Standard,
      bayCount: block.bayCount,
      rowCount: block.rowCount,
      tierCount: block.tierCount,
      maxCapacity: block.maxCapacity,
    };
    this.editMode = true;
    this.editId = block.id;
    this.slideOpen = true;
    this.openMenuId = null;
  }

  get computedCapacity(): number | null {
    if (this.form.blockType !== YardBlockType.Physical) return null;
    const b = this.form.bayCount || 0;
    const r = this.form.rowCount || 0;
    const t = this.form.tierCount || 0;
    return b && r && t ? b * r * t : null;
  }

  save() {
    this.saving = true;
    const req = { ...this.form, maxCapacity: this.computedCapacity ?? this.form.maxCapacity };
    const obs = this.editMode
      ? this.depotService.updateYardBlock(this.editId, req)
      : this.depotService.createYardBlock(req);

    obs.subscribe({
      next: () => {
        this.saving = false;
        this.slideOpen = false;
        this.load();
        this.messageService.add({
          severity: 'success', summary: this.editMode ? 'Updated' : 'Created',
          detail: `Yard block ${this.form.code} ${this.editMode ? 'updated' : 'created'}`, life: 3000,
        });
      },
      error: (err) => {
        this.saving = false;
        this.messageService.add({
          severity: 'error', summary: 'Error',
          detail: err.error?.Message || err.error?.message || 'Operation failed', life: 5000,
        });
      },
    });
  }

  confirmDelete(block: YardBlock) {
    this.confirmTitle = 'Delete Yard Block';
    this.confirmMessage = `Are you sure you want to delete "${block.code}"? This cannot be undone.`;
    this.confirmVariant = 'danger';
    this.pendingAction = () => {
      this.depotService.deleteYardBlock(block.id).subscribe({
        next: () => {
          this.load();
          this.messageService.add({ severity: 'success', summary: 'Deleted', detail: `Block ${block.code} deleted`, life: 3000 });
        },
        error: (err) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.Message || err.error?.message || 'Delete failed', life: 5000 });
        },
      });
    };
    this.confirmOpen = true;
    this.openMenuId = null;
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

  toggleMenu(id: number, event: Event) {
    event.stopPropagation();
    this.openMenuId = this.openMenuId === id ? null : id;
  }
}
