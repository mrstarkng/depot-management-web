import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { DepotService } from '../../core/services/depot.service';
import { AuthService } from '../../core/services/auth.service';
import { StatusBadgeComponent, PaginationComponent } from '../../core/components';
import {
  YardBlock, LineOperator, ContainerOverview, ContainerVisit, ContainerMovement,
  InboundContainerRequest, OutboundContainerRequest, RelocateContainerRequest,
  DeliveryOrder, ContainerGrade, ContainerConditionStatus
} from '../../core/models/depot.models';

@Component({
  selector: 'depot-operations',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ToastModule, StatusBadgeComponent, PaginationComponent],
  providers: [MessageService],
  templateUrl: './operations.component.html',
})
export class OperationsComponent implements OnInit {
  activeTab: 'inbound' | 'outbound' | 'indepot' | 'relocate' = 'inbound';

  // Reference data
  yardBlocks: YardBlock[] = [];
  lineOperators: LineOperator[] = [];
  containers: ContainerOverview[] = [];
  deliveryOrders: DeliveryOrder[] = [];
  inDepotVisits: ContainerVisit[] = [];

  // Inbound form
  inForm = {
    containerSearch: '',
    selectedContainerNumber: '',
    lineOperatorId: 0,
    yardBlockId: 0,
    bay: null as number | null,
    row: null as number | null,
    tier: null as number | null,
    classification: 'A' as ContainerGrade,
    condition: 'Normal' as ContainerConditionStatus,
    inboundVehicle: '',
    remarks: '',
  };
  inboundSaving = false;
  inboundError = '';
  recentInbound: ContainerVisit[] = [];

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
  recentOutbound: ContainerVisit[] = [];
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
    bay: null as number | null,
    row: null as number | null,
    tier: null as number | null,
    classification: 'A' as ContainerGrade,
    condition: 'Normal' as ContainerConditionStatus,
    reason: '',
  };
  relocateSaving = false;
  showRelocate = false;

  // Relocate Tab (4th tab)
  relTabForm = {
    containerSearch: '',
    selectedContainerNumber: '',
    yardBlockId: 0,
    bay: null as number | null,
    row: null as number | null,
    tier: null as number | null,
    remarks: '',
  };
  relTabSaving = false;
  relTabError = '';
  recentRelocations: ContainerVisit[] = [];
  selectedRelTabContainer: ContainerOverview | null = null;

  constructor(
    private depotService: DepotService,
    private messageService: MessageService,
    public authService: AuthService,
  ) {}

  ngOnInit() {
    this.activeTab = this.defaultTab();
    this.loadReferenceData();
    this.loadInDepotVisits();
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
    return this.yardBlocks.find(b => b.id === this.inForm.yardBlockId);
  }

  // ── Inbound ──
  submitInbound() {
    if (!this.authService.canGateInOut()) return;
    if (!this.inForm.selectedContainerNumber || !this.inForm.lineOperatorId || !this.inForm.yardBlockId) return;
    this.inboundSaving = true;
    const req: InboundContainerRequest = {
      containerNumber: this.inForm.selectedContainerNumber,
      lineOperatorId: this.inForm.lineOperatorId,
      yardBlockId: this.inForm.yardBlockId,
      bay: this.inForm.bay ?? undefined,
      row: this.inForm.row ?? undefined,
      tier: this.inForm.tier ?? undefined,
      classification: this.inForm.classification,
      condition: this.inForm.condition,
      inboundVehicle: this.inForm.inboundVehicle,
    };
    this.inboundError = '';
    this.depotService.inboundContainer(req).subscribe({
      next: (visit) => {
        this.inboundSaving = false;
        this.recentInbound = [visit, ...this.recentInbound].slice(0, 15);
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
      bay: null, row: null, tier: null, classification: ContainerGrade.A, condition: ContainerConditionStatus.Normal, inboundVehicle: '', remarks: '',
    };
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
        this.recentOutbound = [visit, ...this.recentOutbound].slice(0, 15);
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

  // ── Relocate ──
  openRelocate(visit: ContainerVisit) {
    if (!this.authService.canManageYard()) return;
    this.selectedVisit = visit;
    this.relocateForm = {
      yardBlockId: visit.yardBlockId,
      bay: visit.bay ?? null,
      row: visit.row ?? null,
      tier: visit.tier ?? null,
      classification: visit.classification,
      condition: visit.condition,
      reason: '',
    };
    this.showRelocate = true;
  }

  get selectedRelocateBlock(): YardBlock | undefined {
    return this.yardBlocks.find(b => b.id === this.relocateForm.yardBlockId);
  }

  submitRelocate() {
    if (!this.authService.canManageYard()) return;
    if (!this.selectedVisit || !this.relocateForm.yardBlockId) return;
    this.relocateSaving = true;
    const req: RelocateContainerRequest = {
      containerNumber: this.selectedVisit.containerNumber,
      yardBlockId: this.relocateForm.yardBlockId,
      bay: this.relocateForm.bay ?? undefined,
      row: this.relocateForm.row ?? undefined,
      tier: this.relocateForm.tier ?? undefined,
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
  }

  get selectedRelTabBlock(): YardBlock | undefined {
    return this.yardBlocks.find(b => b.id === this.relTabForm.yardBlockId);
  }

  submitRelocateTab() {
    if (!this.authService.canManageYard()) return;
    if (!this.relTabForm.selectedContainerNumber || !this.relTabForm.yardBlockId) return;
    this.relTabSaving = true;
    const req: RelocateContainerRequest = {
      containerNumber: this.relTabForm.selectedContainerNumber,
      yardBlockId: this.relTabForm.yardBlockId,
      bay: this.relTabForm.bay ?? undefined,
      row: this.relTabForm.row ?? undefined,
      tier: this.relTabForm.tier ?? undefined,
      classification: ContainerGrade.A,
      condition: ContainerConditionStatus.Normal,
      reason: this.relTabForm.remarks,
    };
    this.relTabError = '';
    this.depotService.relocateContainer(req).subscribe({
      next: (visit) => {
        this.relTabSaving = false;
        this.recentRelocations = [visit, ...this.recentRelocations].slice(0, 15);
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
    this.relTabForm = { containerSearch: '', selectedContainerNumber: '', yardBlockId: 0, bay: null, row: null, tier: null, remarks: '' };
    this.selectedRelTabContainer = null;
    this.relTabError = '';
  }

  get uniqueBlockCodes(): string[] {
    return [...new Set(this.inDepotVisits.map(v => v.yardBlockCode))].sort();
  }

  // ── Bay parity hints (20ft → odd, 40ft → even) ──
  private bayParityHint(size: string | undefined, bay: number | null): string {
    if (bay == null || !size) return '';
    if (size === '20' && bay % 2 === 0) return '20ft containers must use odd bays (1, 3, 5, …).';
    if (size === '40' && bay % 2 !== 0) return '40ft containers must use even bays (2, 4, 6, …).';
    return '';
  }

  get inboundBayHint(): string {
    const size = this.containers.find(c => c.containerNumber === this.inForm.selectedContainerNumber)?.containerSize;
    return this.bayParityHint(size, this.inForm.bay);
  }

  get relocateBayHint(): string {
    if (!this.selectedVisit) return '';
    const size = this.containers.find(c => c.containerNumber === this.selectedVisit!.containerNumber)?.containerSize;
    return this.bayParityHint(size, this.relocateForm.bay);
  }

  get relTabBayHint(): string {
    return this.bayParityHint(this.selectedRelTabContainer?.containerSize, this.relTabForm.bay);
  }
}
