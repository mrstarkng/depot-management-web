import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { DepotService } from '../../core/services/depot.service';
import { AuthService } from '../../core/services/auth.service';
import {
  ContainerOverview,
  CreateDepotContainerRequest,
  UpdateDepotContainerRequest,
  ContainerConditionStatus,
} from '../../core/models/depot.models';
import { StatusBadgeComponent, SlideOverComponent, PaginationComponent, SectionDividerComponent } from '../../core/components';

type SortKey = 'containerNumber' | 'containerType' | 'isoCode' | 'containerSize' | 'containerOwner' | 'containerCondition';

@Component({
  selector: 'depot-container-list',
  standalone: true,
  imports: [FormsModule, RouterModule, ToastModule, StatusBadgeComponent, SlideOverComponent, PaginationComponent, SectionDividerComponent],
  providers: [MessageService],
  templateUrl: './container-list.component.html',
})
export class ContainerListComponent implements OnInit {
  private static readonly PARTIAL_CONTAINER_NUMBER_REGEX = /^[A-Z]{3}[UJZRSFBV]\d{6}$/;
  private static readonly FULL_CONTAINER_NUMBER_REGEX = /^[A-Z]{3}[UJZRSFBV]\d{7}$/;

  containers: ContainerOverview[] = [];
  loading = true;

  // Filters
  search = '';
  filterType = 'All';
  filterSize = 'All';
  filterCondition = 'All';

  // Sort
  sortKey: SortKey = 'containerNumber';
  sortDir: 'asc' | 'desc' = 'asc';

  // Pagination
  page = 1;
  perPage = 25;

  // Options
  typeOptions = ['DRY', 'REEFER', 'OPEN_TOP', 'FLAT_RACK', 'BUNKER', 'VENTILATED', 'SPECIALIZED'];
  sizeOptions = ['20', '40', '45'];

  // Menu
  openMenuId: number | null = null;

  // SlideOver
  slideOpen = false;
  editTarget: ContainerOverview | null = null;
  saving = false;
  today = new Date().toISOString().split('T')[0];

  form: CreateDepotContainerRequest = {
    containerNumber: '',
    containerType: 'DRY',
    isoCode: '',
    containerSize: '20',
    maximumWeight: 30000,
    tareWeight: 2000,
    dateOfManufacture: '',
    containerOwner: '',
    containerCondition: ContainerConditionStatus.Normal,
  };
  errors: Record<string, string> = {};
  containerNumberNotice = '';

  constructor(
    private depotService: DepotService,
    private messageService: MessageService,
    public authService: AuthService,
  ) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.depotService.getContainerOverviews().subscribe({
      next: (d) => { this.containers = d; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  get filtered(): ContainerOverview[] {
    return this.containers.filter(c => {
      const q = this.search.toLowerCase();
      const matchQ = !q || c.containerNumber.toLowerCase().includes(q) || (c.containerOwner?.toLowerCase().includes(q) ?? false);
      const matchType = this.filterType === 'All' || c.containerType === this.filterType;
      const matchSize = this.filterSize === 'All' || c.containerSize === this.filterSize;
      const matchCond = this.filterCondition === 'All' || c.containerCondition === this.filterCondition;
      return matchQ && matchType && matchSize && matchCond;
    });
  }

  get sorted(): ContainerOverview[] {
    return [...this.filtered].sort((a, b) => {
      const va = (a as any)[this.sortKey] ?? '';
      const vb = (b as any)[this.sortKey] ?? '';
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return this.sortDir === 'asc' ? cmp : -cmp;
    });
  }

  get paginated(): ContainerOverview[] {
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
    this.filterType = 'All';
    this.filterSize = 'All';
    this.filterCondition = 'All';
    this.page = 1;
  }

  toggleMenu(id: number, event: Event) {
    event.stopPropagation();
    this.openMenuId = this.openMenuId === id ? null : id;
  }

  openCreate() {
    this.editTarget = null;
    this.form = {
      containerNumber: '',
      containerType: 'DRY',
      isoCode: '',
      containerSize: '20',
      maximumWeight: 30000,
      tareWeight: 2000,
      dateOfManufacture: '',
      containerOwner: '',
      containerCondition: ContainerConditionStatus.Normal,
    };
    this.errors = {};
    this.containerNumberNotice = '';
    this.slideOpen = true;
  }

  openEdit(c: ContainerOverview) {
    this.editTarget = c;
    this.form = {
      containerNumber: c.containerNumber,
      containerType: c.containerType,
      isoCode: c.isoCode || '',
      containerSize: c.containerSize,
      maximumWeight: c.maximumWeight,
      tareWeight: c.tareWeight,
      dateOfManufacture: c.dateOfManufacture ? c.dateOfManufacture.split('T')[0] : '',
      containerOwner: c.containerOwner || '',
      containerCondition: c.containerCondition,
      description: c.description,
    };
    this.errors = {};
    this.containerNumberNotice = '';
    this.slideOpen = true;
    this.openMenuId = null;
  }

  /** ISO 6346 Modulo 11 check digit calculation */
  calculateCheckDigit(containerNum: string): number {
    const letterValues: Record<string, number> = {
      A:10,B:12,C:13,D:14,E:15,F:16,G:17,H:18,I:19,J:20,
      K:21,L:23,M:24,N:25,O:26,P:27,Q:28,R:29,S:30,T:31,
      U:32,V:34,W:35,X:36,Y:37,Z:38
    };
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      const ch = containerNum[i];
      const val = letterValues[ch] ?? Number(ch);
      sum += val * Math.pow(2, i);
    }
    const remainder = sum % 11;
    return remainder === 10 ? 0 : remainder;
  }

  checkingUniqueness = false;

  onContainerNumberChange(value: string) {
    this.form.containerNumber = value.toUpperCase();
    this.containerNumberNotice = '';
  }

  normalizeContainerNumberInput() {
    const trimmed = this.form.containerNumber.trim().toUpperCase();

    if (ContainerListComponent.PARTIAL_CONTAINER_NUMBER_REGEX.test(trimmed)) {
      const checkDigit = this.calculateCheckDigit(trimmed);
      this.form.containerNumber = `${trimmed}${checkDigit}`;
      this.containerNumberNotice = `Check digit ${checkDigit} was appended automatically.`;
      return;
    }

    this.form.containerNumber = trimmed;
    this.containerNumberNotice = '';
  }

  checkContainerUniqueness() {
    this.normalizeContainerNumberInput();

    const trimmed = this.form.containerNumber.trim().toUpperCase();
    if (!trimmed || !ContainerListComponent.FULL_CONTAINER_NUMBER_REGEX.test(trimmed) || this.editTarget) return;

    // Check locally first
    if (this.containers.some(c => c.containerNumber === trimmed)) {
      this.errors['containerNumber'] = 'Container number already exists';
      return;
    }

    // Check server
    this.checkingUniqueness = true;
    this.depotService.getContainerByNumber(trimmed).subscribe({
      next: () => {
        this.errors['containerNumber'] = 'Container number already exists';
        this.checkingUniqueness = false;
      },
      error: () => {
        // 404 means not found = unique
        delete this.errors['containerNumber'];
        this.checkingUniqueness = false;
      },
    });
  }

  validate(): boolean {
    this.errors = {};
    this.normalizeContainerNumberInput();

    let trimmed = this.form.containerNumber.trim().toUpperCase();
    this.form.containerNumber = trimmed;

    if (!trimmed) {
      this.errors['containerNumber'] = 'Container number is required';
    } else if (!ContainerListComponent.FULL_CONTAINER_NUMBER_REGEX.test(trimmed)) {
      this.errors['containerNumber'] = ContainerListComponent.PARTIAL_CONTAINER_NUMBER_REGEX.test(trimmed)
        ? 'Container number is missing the final check digit'
        : 'Format: owner code (3 letters) + equipment category + 7 digits';
    } else {
      const expected = this.calculateCheckDigit(trimmed);
      const actual = Number(trimmed[10]);
      if (expected !== actual) {
        this.errors['containerNumber'] = `Check digit invalid: expected ${expected}, got ${actual} (ISO 6346)`;
      } else if (!this.editTarget && this.containers.some(c => c.containerNumber === trimmed)) {
        this.errors['containerNumber'] = 'Container number already exists';
      }
    }

    if (!this.form.containerType) this.errors['containerType'] = 'Required';
    if (!this.form.isoCode) this.errors['isoCode'] = 'Required';
    if (!this.form.maximumWeight || this.form.maximumWeight <= 0) this.errors['maximumWeight'] = 'Must be > 0';
    if (!this.form.tareWeight || this.form.tareWeight <= 0) this.errors['tareWeight'] = 'Must be > 0';
    else if (this.form.tareWeight >= this.form.maximumWeight) this.errors['tareWeight'] = 'Must be less than max weight';
    if (!this.form.containerOwner.trim()) this.errors['containerOwner'] = 'Required';

    return Object.keys(this.errors).length === 0;
  }

  save() {
    if (!this.validate()) return;
    this.saving = true;

    if (this.editTarget) {
      const payload: UpdateDepotContainerRequest = {
        containerType: this.form.containerType,
        isoCode: this.form.isoCode,
        containerSize: this.form.containerSize,
        maximumWeight: this.form.maximumWeight,
        tareWeight: this.form.tareWeight,
        dateOfManufacture: this.form.dateOfManufacture ? `${this.form.dateOfManufacture}T00:00:00Z` : undefined,
        containerOwner: this.form.containerOwner,
        containerCondition: this.form.containerCondition,
        isActive: this.editTarget.isActive,
        description: this.form.description,
      };

      this.depotService.updateContainer(this.editTarget.containerId, payload).subscribe({
        next: () => {
          this.saving = false;
          this.slideOpen = false;
          this.load();
          this.messageService.add({ severity: 'success', summary: 'Updated', detail: `Container ${this.form.containerNumber} updated`, life: 3000 });
        },
        error: (err) => {
          this.saving = false;
          this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.Message || err.error?.message || 'Update failed', life: 5000 });
        },
      });
    } else {
      const payload: CreateDepotContainerRequest = {
        ...this.form,
        dateOfManufacture: this.form.dateOfManufacture ? this.form.dateOfManufacture + 'T00:00:00Z' : undefined,
      };
      this.depotService.createContainer(payload).subscribe({
        next: () => {
          this.saving = false;
          this.slideOpen = false;
          this.load();
          this.messageService.add({ severity: 'success', summary: 'Created', detail: `Container ${this.form.containerNumber} created`, life: 3000 });
        },
        error: (err) => {
          this.saving = false;
          this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.Message || err.error?.message || 'Create failed', life: 5000 });
        },
      });
    }
  }
}
