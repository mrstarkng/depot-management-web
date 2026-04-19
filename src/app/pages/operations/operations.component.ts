import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormControl,
  FormGroup,
  Validators,
  ValidatorFn,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { DepotService } from '../../core/services/depot.service';
import { AuthService } from '../../core/services/auth.service';
import { StatusBadgeComponent, PaginationComponent } from '../../core/components';
import {
  YardBlock, LineOperator, ContainerOverview, ContainerVisit, ContainerMovement,
  InboundContainerRequest, OutboundContainerRequest, RelocateContainerRequest,
  DeliveryOrder, ContainerGrade, ContainerConditionStatus,
  StackStateDto, StackStateTier,
} from '../../core/models/depot.models';
import { Subject, debounceTime } from 'rxjs';

// ── Validator factories (exported for unit tests) ────────────────────────────
/**
 * Bay parity rule (BR-CV-02):
 * - 20ft container → bay must be odd (1, 3, 5, …).
 * - 40ft or 45ft container → bay must be even (2, 4, 6, …).
 * Size is read lazily so the validator reacts to the currently selected container.
 */
export function bayParityValidator(sizeGetter: () => string | undefined | null): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const rawBay = control.value;
    const size = (sizeGetter() ?? '').toString();
    if (rawBay === null || rawBay === undefined || rawBay === '' || !size) return null;
    const bay = Number(rawBay);
    if (!Number.isFinite(bay) || bay < 1) return null;
    if (size === '20' && bay % 2 === 0) {
      return { bayParity: { size, expected: 'odd', actual: bay } };
    }
    if ((size === '40' || size === '45') && bay % 2 !== 0) {
      return { bayParity: { size, expected: 'even', actual: bay } };
    }
    return null;
  };
}

/**
 * Dynamic upper-bound validator. The limit is read via getter so it tracks the
 * currently selected block dimensions without needing to rebuild validators.
 */
/**
 * Tier stack rule (BR-FE-UI-03):
 * - Tier 1 is always valid.
 * - Tier N >= 2 requires tier N-1 to be occupied.
 * - Target tier must not itself be already occupied.
 * Stack state is read lazily via getter so the validator stays in sync with
 * the most recent API response.
 */
export function tierStackValidator(stackGetter: () => StackStateDto | null): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = control.value;
    if (raw === null || raw === undefined || raw === '') return null;
    const tier = Number(raw);
    if (!Number.isFinite(tier) || tier < 1) return null;
    const stack = stackGetter();
    if (!stack) return null;
    const tiers = stack.tiers ?? [];
    const target = tiers.find(t => t.tier === tier);
    if (target?.occupied) {
      return { tierStack: { reason: 'occupied', tier } };
    }
    if (tier === 1) return null;
    const below = tiers.find(t => t.tier === tier - 1);
    if (!below?.occupied) {
      return { tierStack: { reason: 'noBottom', tier } };
    }
    return null;
  };
}

export function maxFromGetter(maxGetter: () => number | null | undefined): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const max = maxGetter();
    if (max == null) return null;
    const v = control.value;
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return n > max ? { maxBound: { max, actual: n } } : null;
  };
}

type PositionGroup = FormGroup<{
  bay: FormControl<number | null>;
  row: FormControl<number | null>;
  tier: FormControl<number | null>;
}>;

function buildPositionGroup(
  sizeGetter: () => string | undefined | null,
  blockGetter: () => YardBlock | undefined,
): PositionGroup {
  return new FormGroup({
    bay: new FormControl<number | null>(null, [
      Validators.min(1),
      maxFromGetter(() => blockGetter()?.bayCount ?? null),
      bayParityValidator(sizeGetter),
    ]),
    row: new FormControl<number | null>(null, [
      Validators.min(1),
      maxFromGetter(() => blockGetter()?.rowCount ?? null),
    ]),
    tier: new FormControl<number | null>(null, [
      Validators.min(1),
      maxFromGetter(() => blockGetter()?.tierCount ?? null),
    ]),
  });
}

@Component({
  selector: 'depot-operations',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, ToastModule, StatusBadgeComponent, PaginationComponent],
  providers: [MessageService],
  templateUrl: './operations.component.html',
})
export class OperationsComponent implements OnInit {
  activeTab: 'inbound' | 'outbound' | 'indepot' | 'relocate' = 'inbound';

  // ── Stack state cache (TF-02 / BR-FE-UI-03) ────────────────────────────
  inboundStack: StackStateDto | null = null;
  relocateStack: StackStateDto | null = null;
  relTabStack: StackStateDto | null = null;
  private readonly inboundStackQuery$ = new Subject<{ blockId: number; bay: number; row: number }>();
  private readonly relocateStackQuery$ = new Subject<{ blockId: number; bay: number; row: number }>();
  private readonly relTabStackQuery$ = new Subject<{ blockId: number; bay: number; row: number }>();

  // Reference data
  yardBlocks: YardBlock[] = [];
  lineOperators: LineOperator[] = [];
  containers: ContainerOverview[] = [];
  deliveryOrders: DeliveryOrder[] = [];
  inDepotVisits: ContainerVisit[] = [];

  // Inbound form (non-position fields use template-driven ngModel;
  // bay/row/tier moved to `inboundPos` FormGroup for validation).
  inForm = {
    containerSearch: '',
    selectedContainerNumber: '',
    lineOperatorId: 0,
    yardBlockId: 0,
    classification: 'A' as ContainerGrade,
    condition: 'Normal' as ContainerConditionStatus,
    inboundVehicle: '',
    remarks: '',
  };
  inboundSaving = false;
  inboundError = '';
  // Date the 3 "Recent ..." ledgers are showing (inbound / outbound /
  // relocate). Default = today. Rule: these ledgers must reflect the
  // backend's authoritative history for the selected day — never a session
  // log. User may change the date to browse past days.
  historyDate: string = this.todayIso();
  allVisits: ContainerVisit[] = [];

  get recentInbound(): ContainerVisit[] {
    return this.allVisits
      .filter(v => v.inboundAt && this.toIsoDate(v.inboundAt) === this.historyDate)
      .sort((a, b) => new Date(b.inboundAt).getTime() - new Date(a.inboundAt).getTime());
  }
  readonly inboundPos: PositionGroup = buildPositionGroup(
    () => this.containers.find(c => c.containerNumber === this.inForm.selectedContainerNumber)?.containerSize,
    () => this.selectedInboundBlock,
  );

  // Outbound form
  outForm = {
    containerSearch: '',
    selectedContainerNumber: '',
    orderSearch: '',
    selectedOrderNumber: '',
    outboundVehicle: '',
    remarks: '',
  };
  outboundSaving = false;
  outboundError = '';
  get recentOutbound(): ContainerVisit[] {
    return this.allVisits
      .filter(v => v.outboundAt && this.toIsoDate(v.outboundAt) === this.historyDate)
      .sort((a, b) => new Date(b.outboundAt!).getTime() - new Date(a.outboundAt!).getTime());
  }
  selectedOutboundVisit: ContainerVisit | null = null;

  // In Depot
  depotSearch = '';
  depotBlock = 'All';
  depotClass = 'All';
  depotType = 'All';
  depotPage = 1;
  depotPerPage = 25;
  selectedVisit: ContainerVisit | null = null;
  selectedMovements: ContainerMovement[] = [];

  // Relocate (slide-over from In Depot)
  relocateForm = {
    yardBlockId: 0,
    classification: 'A' as ContainerGrade,
    condition: 'Normal' as ContainerConditionStatus,
    reason: '',
  };
  relocateSaving = false;
  showRelocate = false;
  readonly relocatePos: PositionGroup = buildPositionGroup(
    () => this.containers.find(c => c.containerNumber === this.selectedVisit?.containerNumber)?.containerSize,
    () => this.selectedRelocateBlock,
  );

  // Relocate Tab (4th tab)
  relTabForm = {
    containerSearch: '',
    selectedContainerNumber: '',
    yardBlockId: 0,
    remarks: '',
  };
  relTabSaving = false;
  relTabError = '';
  // Relocate ledger derived from visits whose `lastMovementAt` falls on the
  // selected day AND movement type is Relocate. Using `lastMovementAt` is a
  // best-effort proxy until BE exposes a movements-by-date endpoint; covers
  // the common case where the last movement IS the relocate.
  get recentRelocations(): ContainerVisit[] {
    return this.allVisits
      .filter(v => v.lastMovementAt
        && v.inboundAt
        && this.toIsoDate(v.lastMovementAt) === this.historyDate
        // Exclude pure inbound records (last move = inbound).
        && this.toIsoDate(v.lastMovementAt) !== this.toIsoDate(v.inboundAt))
      .sort((a, b) => new Date(b.lastMovementAt!).getTime() - new Date(a.lastMovementAt!).getTime());
  }
  selectedRelTabContainer: ContainerOverview | null = null;
  readonly relTabPos: PositionGroup = buildPositionGroup(
    () => this.selectedRelTabContainer?.containerSize,
    () => this.selectedRelTabBlock,
  );

  constructor(
    private depotService: DepotService,
    private messageService: MessageService,
    public authService: AuthService,
  ) {}

  ngOnInit() {
    this.activeTab = this.defaultTab();
    this.loadReferenceData();
    this.loadInDepotVisits();

    // TF-02 — debounced stack-state fetch for each of 3 position forms
    this.inboundStackQuery$.pipe(debounceTime(300)).subscribe(q => {
      this.depotService.getBlockStackState(q.blockId, q.bay, q.row).subscribe({
        next: s => { this.inboundStack = s; this.inboundPos.controls.tier.updateValueAndValidity(); },
        error: () => { this.inboundStack = null; },
      });
    });
    this.relocateStackQuery$.pipe(debounceTime(300)).subscribe(q => {
      this.depotService.getBlockStackState(q.blockId, q.bay, q.row).subscribe({
        next: s => { this.relocateStack = s; this.relocatePos.controls.tier.updateValueAndValidity(); },
        error: () => { this.relocateStack = null; },
      });
    });
    this.relTabStackQuery$.pipe(debounceTime(300)).subscribe(q => {
      this.depotService.getBlockStackState(q.blockId, q.bay, q.row).subscribe({
        next: s => { this.relTabStack = s; this.relTabPos.controls.tier.updateValueAndValidity(); },
        error: () => { this.relTabStack = null; },
      });
    });

    // Feed the subjects when bay/row change on each form
    this.inboundPos.valueChanges.subscribe(v => {
      const block = this.selectedInboundBlock;
      if (block?.blockType === 'Physical' && block.id && v.bay && v.row) {
        this.inboundStackQuery$.next({ blockId: block.id, bay: Number(v.bay), row: Number(v.row) });
      } else {
        this.inboundStack = null;
      }
    });
    this.relocatePos.valueChanges.subscribe(v => {
      const block = this.selectedRelocateBlock;
      if (block?.blockType === 'Physical' && block.id && v.bay && v.row) {
        this.relocateStackQuery$.next({ blockId: block.id, bay: Number(v.bay), row: Number(v.row) });
      } else {
        this.relocateStack = null;
      }
    });
    this.relTabPos.valueChanges.subscribe(v => {
      const block = this.selectedRelTabBlock;
      if (block?.blockType === 'Physical' && block.id && v.bay && v.row) {
        this.relTabStackQuery$.next({ blockId: block.id, bay: Number(v.bay), row: Number(v.row) });
      } else {
        this.relTabStack = null;
      }
    });

    // Attach tier stack async-style validators (sync check against cached state)
    this.inboundPos.controls.tier.addValidators(
      tierStackValidator(() => this.inboundStack),
    );
    this.relocatePos.controls.tier.addValidators(
      tierStackValidator(() => this.relocateStack),
    );
    this.relTabPos.controls.tier.addValidators(
      tierStackValidator(() => this.relTabStack),
    );
  }

  /**
   * Tier N is enable-able when:
   *  - N === 1 (ground level) — always available.
   *  - N >= 2 — only if tier N-1 is occupied=true in the fetched stack state.
   * Also: the target tier itself must not already be occupied.
   */
  isTierEnabled(stack: StackStateDto | null, tier: number): boolean {
    if (tier < 1) return false;
    if (!stack) return true; // no data yet: don't block user
    const tiers = stack.tiers ?? [];
    const target = tiers.find(t => t.tier === tier);
    if (target?.occupied) return false;
    if (tier === 1) return true;
    const below = tiers.find(t => t.tier === tier - 1);
    return !!below?.occupied;
  }

  tierOptionsFor(block: YardBlock | undefined, stack: StackStateDto | null): { tier: number; enabled: boolean; occupied: boolean }[] {
    const max = block?.tierCount ?? 0;
    const result: { tier: number; enabled: boolean; occupied: boolean }[] = [];
    for (let t = 1; t <= max; t++) {
      const occupied = !!stack?.tiers.find(x => x.tier === t)?.occupied;
      result.push({ tier: t, enabled: this.isTierEnabled(stack, t), occupied });
    }
    return result;
  }

  private defaultTab(): 'inbound' | 'outbound' | 'indepot' | 'relocate' {
    if (this.authService.canGateInOut()) {
      return 'inbound';
    }
    if (this.authService.canManageYard()) {
      return 'indepot';
    }
    return 'indepot';
  }

  canAccessTab(tab: 'inbound' | 'outbound' | 'indepot' | 'relocate'): boolean {
    if (tab === 'inbound' || tab === 'outbound') {
      return this.authService.canGateInOut();
    }
    if (tab === 'indepot' || tab === 'relocate') {
      return this.authService.canManageYard();
    }
    return false;
  }

  setActiveTab(tab: 'inbound' | 'outbound' | 'indepot' | 'relocate') {
    if (this.canAccessTab(tab)) {
      this.activeTab = tab;
      return;
    }
    this.activeTab = this.defaultTab();
  }

  loadReferenceData() {
    this.depotService.getYardBlocks().subscribe(d => this.yardBlocks = d);
    this.depotService.getLineOperators().subscribe(d => this.lineOperators = d);
    this.depotService.getContainerOverviews().subscribe(d => this.containers = d);
    this.depotService.getDeliveryOrders({ hasRemainingQuantity: true }).subscribe(d => this.deliveryOrders = d);
  }

  loadInDepotVisits() {
    this.depotService.getContainerVisits({ status: 'InDepot' }).subscribe(d => this.inDepotVisits = d);
    // Ledger for Recent Inbound / Outbound / Relocate. Fetch full history
    // (no status filter) so the ledger can show both active and released
    // visits for the selected `historyDate`.
    this.depotService.getContainerVisits().subscribe(d => this.allVisits = d);
  }

  private todayIso(): string {
    const d = new Date();
    return this.toIsoDate(d);
  }

  private toIsoDate(input: string | Date): string {
    const d = typeof input === 'string' ? new Date(input) : input;
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  onHistoryDateChange(iso: string) {
    this.historyDate = iso || this.todayIso();
    // Re-fetch ledger data to pick up any rows created while viewing.
    this.depotService.getContainerVisits().subscribe(d => this.allVisits = d);
  }

  // ── Container search helpers ──
  get filteredContainersForInbound(): ContainerOverview[] {
    const q = this.inForm.containerSearch.toUpperCase();
    if (!q) return [];
    return this.containers
      .filter(c => !c.isInDepot && c.containerNumber.includes(q))
      .slice(0, 8);
  }

  get filteredContainersForOutbound(): ContainerOverview[] {
    const q = this.outForm.containerSearch.toUpperCase();
    if (!q) return [];
    return this.containers
      .filter(c => c.isInDepot && c.containerNumber.includes(q))
      .slice(0, 8);
  }

  get filteredOrders(): DeliveryOrder[] {
    const q = this.outForm.orderSearch.toUpperCase();
    if (!q) return [];
    return this.deliveryOrders
      .filter(o => !o.isExpired && o.hasRemainingQuantity && o.orderNumber.includes(q))
      .slice(0, 8);
  }

  selectInboundContainer(c: ContainerOverview) {
    this.inForm.selectedContainerNumber = c.containerNumber;
    this.inForm.containerSearch = c.containerNumber;
    // Container size drives bay-parity; refresh validators.
    this.inboundPos.controls.bay.updateValueAndValidity();
  }

  selectOutboundContainer(c: ContainerOverview) {
    this.outForm.selectedContainerNumber = c.containerNumber;
    this.outForm.containerSearch = c.containerNumber;
    const visit = this.inDepotVisits.find(v => v.containerNumber === c.containerNumber);
    this.selectedOutboundVisit = visit || null;
  }

  selectOrder(o: DeliveryOrder) {
    this.outForm.selectedOrderNumber = o.orderNumber;
    this.outForm.orderSearch = o.orderNumber;
  }

  get selectedInboundBlock(): YardBlock | undefined {
    return this.yardBlocks.find(b => b.id === Number(this.inForm.yardBlockId));
  }

  onInboundBlockChange(): void {
    this.inboundPos.updateValueAndValidity({ emitEvent: false });
    this.inboundPos.controls.bay.updateValueAndValidity();
    this.inboundPos.controls.row.updateValueAndValidity();
    this.inboundPos.controls.tier.updateValueAndValidity();
  }

  // ── Inbound ──
  get inboundFormInvalid(): boolean {
    if (!this.inForm.selectedContainerNumber || !this.inForm.lineOperatorId || !this.inForm.yardBlockId || !this.inForm.inboundVehicle) {
      return true;
    }
    if (this.selectedInboundBlock?.blockType === 'Physical' && this.inboundPos.invalid) {
      return true;
    }
    return false;
  }

  submitInbound() {
    if (!this.authService.canGateInOut()) return;
    if (this.inboundFormInvalid) return;
    this.inboundSaving = true;
    const pos = this.inboundPos.value;
    const req: InboundContainerRequest = {
      containerNumber: this.inForm.selectedContainerNumber,
      lineOperatorId: this.inForm.lineOperatorId,
      yardBlockId: Number(this.inForm.yardBlockId),
      bay: pos.bay ?? undefined,
      row: pos.row ?? undefined,
      tier: pos.tier ?? undefined,
      classification: this.inForm.classification,
      condition: this.inForm.condition,
      inboundVehicle: this.inForm.inboundVehicle,
    };
    this.inboundError = '';
    this.depotService.inboundContainer(req).subscribe({
      next: (visit) => {
        this.inboundSaving = false;
        // Ledger reloads from BE via loadInDepotVisits() below — the
        // recentInbound getter derives from allVisits, so no session push.
        this.messageService.add({
          severity: 'success', summary: 'Gate-In Recorded',
          detail: `${visit.containerNumber} → ${visit.yardBlockCode}`, life: 3000,
        });
        this.resetInboundForm();
        this.loadReferenceData();
        this.loadInDepotVisits();
      },
      error: (err) => {
        this.inboundSaving = false;
        const msg = err.error?.Message || err.error?.message || 'Operation failed';
        this.inboundError = msg;
        this.messageService.add({ severity: 'error', summary: 'Gate-In Failed', detail: msg, life: 5000 });
      },
    });
  }

  resetInboundForm() {
    this.inForm = {
      containerSearch: '', selectedContainerNumber: '', lineOperatorId: 0, yardBlockId: 0,
      classification: ContainerGrade.A, condition: ContainerConditionStatus.Normal, inboundVehicle: '', remarks: '',
    };
    this.inboundPos.reset({ bay: null, row: null, tier: null });
    this.inboundError = '';
  }

  // ── Outbound ──
  submitOutbound() {
    if (!this.authService.canGateInOut()) return;
    if (!this.outForm.selectedContainerNumber) return;
    this.outboundSaving = true;
    const req: OutboundContainerRequest = {
      containerNumber: this.outForm.selectedContainerNumber,
      orderNumber: this.outForm.selectedOrderNumber || undefined,
      outboundVehicle: this.outForm.outboundVehicle,
    };
    this.outboundError = '';
    this.depotService.outboundContainer(req).subscribe({
      next: (visit) => {
        this.outboundSaving = false;
        // Ledger reloads via loadInDepotVisits() — getter derives.
        this.messageService.add({
          severity: 'success', summary: 'Gate-Out Recorded',
          detail: `${visit.containerNumber} released${visit.deliveryOrderNumber ? ' via ' + visit.deliveryOrderNumber : ''}`, life: 3000,
        });
        this.resetOutboundForm();
        this.loadReferenceData();
        this.loadInDepotVisits();
      },
      error: (err) => {
        this.outboundSaving = false;
        const msg = err.error?.Message || err.error?.message || 'Operation failed';
        this.outboundError = msg;
        this.messageService.add({ severity: 'error', summary: 'Gate-Out Failed', detail: msg, life: 5000 });
      },
    });
  }

  resetOutboundForm() {
    this.outForm = { containerSearch: '', selectedContainerNumber: '', orderSearch: '', selectedOrderNumber: '', outboundVehicle: '', remarks: '' };
    this.selectedOutboundVisit = null;
    this.outboundError = '';
  }

  // ── In Depot ──
  get physicalCount(): number {
    return this.inDepotVisits.filter(v => {
      const block = this.yardBlocks.find(b => b.code === v.yardBlockCode);
      return block?.blockType === 'Physical';
    }).length;
  }

  get virtualCount(): number {
    return this.inDepotVisits.length - this.physicalCount;
  }

  get filteredDepotVisits(): ContainerVisit[] {
    return this.inDepotVisits.filter(v => {
      const q = this.depotSearch.toLowerCase();
      const matchQ = !q || v.containerNumber.toLowerCase().includes(q);
      const matchBlock = this.depotBlock === 'All' || v.yardBlockCode === this.depotBlock;
      const matchClass = this.depotClass === 'All' || v.classification === this.depotClass;
      let matchType = true;
      if (this.depotType !== 'All') {
        const container = this.containers.find(c => c.containerNumber === v.containerNumber);
        matchType = container?.containerType === this.depotType;
      }
      return matchQ && matchBlock && matchClass && matchType;
    });
  }

  get paginatedDepotVisits(): ContainerVisit[] {
    const start = (this.depotPage - 1) * this.depotPerPage;
    return this.filteredDepotVisits.slice(start, start + this.depotPerPage);
  }

  selectDepotVisit(visit: ContainerVisit) {
    if (this.selectedVisit?.id === visit.id) {
      this.selectedVisit = null;
      this.selectedMovements = [];
      return;
    }
    this.selectedVisit = visit;
    this.depotService.getMovements(visit.id).subscribe(m => this.selectedMovements = m);
  }

  // ── Relocate (slide-over) ──
  openRelocate(visit: ContainerVisit) {
    if (!this.authService.canManageYard()) return;
    this.selectedVisit = visit;
    this.relocateForm = {
      yardBlockId: visit.yardBlockId,
      classification: visit.classification,
      condition: visit.condition,
      reason: '',
    };
    this.relocatePos.setValue({
      bay: visit.bay ?? null,
      row: visit.row ?? null,
      tier: visit.tier ?? null,
    });
    this.relocatePos.markAsPristine();
    this.showRelocate = true;
  }

  get selectedRelocateBlock(): YardBlock | undefined {
    return this.yardBlocks.find(b => b.id === Number(this.relocateForm.yardBlockId));
  }

  onRelocateBlockChange(): void {
    this.relocatePos.controls.bay.updateValueAndValidity();
    this.relocatePos.controls.row.updateValueAndValidity();
    this.relocatePos.controls.tier.updateValueAndValidity();
  }

  get relocateFormInvalid(): boolean {
    if (!this.selectedVisit || !this.relocateForm.yardBlockId) return true;
    if (this.selectedRelocateBlock?.blockType === 'Physical' && this.relocatePos.invalid) return true;
    return false;
  }

  submitRelocate() {
    if (!this.authService.canManageYard()) return;
    if (this.relocateFormInvalid) return;
    this.relocateSaving = true;
    const pos = this.relocatePos.value;
    const req: RelocateContainerRequest = {
      containerNumber: this.selectedVisit!.containerNumber,
      yardBlockId: Number(this.relocateForm.yardBlockId),
      bay: pos.bay ?? undefined,
      row: pos.row ?? undefined,
      tier: pos.tier ?? undefined,
      classification: this.relocateForm.classification,
      condition: this.relocateForm.condition,
      reason: this.relocateForm.reason,
    };
    this.depotService.relocateContainer(req).subscribe({
      next: (visit) => {
        this.relocateSaving = false;
        this.showRelocate = false;
        this.messageService.add({
          severity: 'success', summary: 'Relocated',
          detail: `${visit.containerNumber} → ${visit.yardBlockCode}`, life: 3000,
        });
        this.loadInDepotVisits();
        this.loadReferenceData();
      },
      error: (err) => {
        this.relocateSaving = false;
        this.messageService.add({
          severity: 'error', summary: 'Relocate Failed',
          detail: err.error?.Message || err.error?.message || 'Operation failed', life: 5000,
        });
      },
    });
  }

  // ── Relocate Tab ──
  get filteredContainersForRelocate(): ContainerOverview[] {
    const q = this.relTabForm.containerSearch.toUpperCase();
    if (!q) return [];
    return this.containers
      .filter(c => c.isInDepot && c.containerNumber.includes(q))
      .slice(0, 8);
  }

  selectRelocateTabContainer(c: ContainerOverview) {
    this.relTabForm.selectedContainerNumber = c.containerNumber;
    this.relTabForm.containerSearch = c.containerNumber;
    this.selectedRelTabContainer = c;
    this.relTabPos.controls.bay.updateValueAndValidity();
  }

  get selectedRelTabBlock(): YardBlock | undefined {
    return this.yardBlocks.find(b => b.id === Number(this.relTabForm.yardBlockId));
  }

  onRelTabBlockChange(): void {
    this.relTabPos.controls.bay.updateValueAndValidity();
    this.relTabPos.controls.row.updateValueAndValidity();
    this.relTabPos.controls.tier.updateValueAndValidity();
  }

  get relTabFormInvalid(): boolean {
    if (!this.relTabForm.selectedContainerNumber || !this.relTabForm.yardBlockId) return true;
    if (this.selectedRelTabBlock?.blockType === 'Physical' && this.relTabPos.invalid) return true;
    return false;
  }

  submitRelocateTab() {
    if (!this.authService.canManageYard()) return;
    if (this.relTabFormInvalid) return;
    this.relTabSaving = true;
    const pos = this.relTabPos.value;
    const req: RelocateContainerRequest = {
      containerNumber: this.relTabForm.selectedContainerNumber,
      yardBlockId: Number(this.relTabForm.yardBlockId),
      bay: pos.bay ?? undefined,
      row: pos.row ?? undefined,
      tier: pos.tier ?? undefined,
      classification: ContainerGrade.A,
      condition: ContainerConditionStatus.Normal,
      reason: this.relTabForm.remarks,
    };
    this.relTabError = '';
    this.depotService.relocateContainer(req).subscribe({
      next: (visit) => {
        this.relTabSaving = false;
        // Ledger reloads via loadInDepotVisits() — getter derives.
        this.messageService.add({
          severity: 'success', summary: 'Relocated',
          detail: `${visit.containerNumber} → ${visit.yardBlockCode}${visit.bay ? ' Bay ' + visit.bay : ''}`, life: 3000,
        });
        this.resetRelocateTabForm();
        this.loadReferenceData();
        this.loadInDepotVisits();
      },
      error: (err) => {
        this.relTabSaving = false;
        const msg = err.error?.Message || err.error?.message || 'Operation failed';
        this.relTabError = msg;
        this.messageService.add({ severity: 'error', summary: 'Relocate Failed', detail: msg, life: 5000 });
      },
    });
  }

  resetRelocateTabForm() {
    this.relTabForm = { containerSearch: '', selectedContainerNumber: '', yardBlockId: 0, remarks: '' };
    this.relTabPos.reset({ bay: null, row: null, tier: null });
    this.selectedRelTabContainer = null;
    this.relTabError = '';
  }

  get uniqueBlockCodes(): string[] {
    return [...new Set(this.inDepotVisits.map(v => v.yardBlockCode))].sort();
  }

  // ── TF-05 — Block capacity helpers ───────────────────────────────────────
  isBlockFull(block: YardBlock): boolean {
    if (!block.maxCapacity) return false;
    return block.activeContainerCount >= block.maxCapacity;
  }

  isBlockNearFull(block: YardBlock): boolean {
    if (!block.maxCapacity) return false;
    return block.activeContainerCount / block.maxCapacity >= 0.95 && !this.isBlockFull(block);
  }

  blockOccupancyPercent(block: YardBlock): number {
    if (!block.maxCapacity) return 0;
    return Math.round((block.activeContainerCount / block.maxCapacity) * 100);
  }

  // ── Error helpers for templates (Vietnamese messages) ──────────────────────
  bayErrorText(control: AbstractControl | null): string {
    if (!control || !control.errors) return '';
    if (control.errors['bayParity']) {
      const { size, expected } = control.errors['bayParity'] as { size: string; expected: 'odd' | 'even' };
      return expected === 'odd'
        ? `Container ${size}ft phải đặt ở bay lẻ (1, 3, 5, …).`
        : `Container ${size}ft phải đặt ở bay chẵn (2, 4, 6, …).`;
    }
    if (control.errors['maxBound']) {
      return `Bay vượt quá giới hạn block (tối đa ${control.errors['maxBound'].max}).`;
    }
    if (control.errors['min']) {
      return `Bay phải ≥ 1.`;
    }
    return '';
  }

  rowErrorText(control: AbstractControl | null): string {
    if (!control || !control.errors) return '';
    if (control.errors['maxBound']) {
      return `Row vượt quá giới hạn block (tối đa ${control.errors['maxBound'].max}).`;
    }
    if (control.errors['min']) {
      return `Row phải ≥ 1.`;
    }
    return '';
  }

  tierErrorText(control: AbstractControl | null): string {
    if (!control || !control.errors) return '';
    if (control.errors['tierStack']) {
      const reason = control.errors['tierStack'].reason;
      return reason === 'occupied'
        ? `Tier ${control.errors['tierStack'].tier} đã có container — chọn tier khác.`
        : `Tier ${control.errors['tierStack'].tier} không hợp lệ: cần có container ở tier bên dưới trước.`;
    }
    if (control.errors['maxBound']) {
      return `Tier vượt quá giới hạn block (tối đa ${control.errors['maxBound'].max}).`;
    }
    if (control.errors['min']) {
      return `Tier phải ≥ 1.`;
    }
    return '';
  }

  // Legacy hint getters retained for backward compatibility with existing tests/copy.
  get inboundBayHint(): string {
    return this.bayErrorText(this.inboundPos.controls.bay);
  }
  get relocateBayHint(): string {
    return this.bayErrorText(this.relocatePos.controls.bay);
  }
  get relTabBayHint(): string {
    return this.bayErrorText(this.relTabPos.controls.bay);
  }
}
