import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { DepotService } from '../../core/services/depot.service';
import { AuthService } from '../../core/services/auth.service';
import {
  DepotContainer, ContainerCurrentLocation, ContainerVisitHistory,
  YardBlock, ContainerGrade, ContainerConditionStatus
} from '../../core/models/depot.models';
import { StatusBadgeComponent, SlideOverComponent, SectionDividerComponent } from '../../core/components';

@Component({
  selector: 'depot-container-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ToastModule, DatePipe, StatusBadgeComponent, SlideOverComponent, SectionDividerComponent],
  providers: [MessageService],
  templateUrl: './container-detail.component.html',
})
export class ContainerDetailComponent implements OnInit {
  containerNumber = '';
  container: DepotContainer | null = null;
  location: ContainerCurrentLocation | null = null;
  visitHistory: ContainerVisitHistory[] = [];
  yardBlocks: YardBlock[] = [];
  yardBlockOptions: { label: string; value: number }[] = [];

  // Relocate
  relocateSlideOpen = false;
  relocating = false;
  relocateForm: { yardBlockId: number; bay: number | null; row: number | null; tier: number | null; reason: string } = {
    yardBlockId: 0, bay: 1, row: 1, tier: 1, reason: '',
  };

  get selectedRelocateBlock(): YardBlock | undefined {
    return this.yardBlocks.find(b => b.id === Number(this.relocateForm.yardBlockId));
  }

  get relocateFormInvalid(): boolean {
    const block = this.selectedRelocateBlock;
    if (!block) return true;
    if (block.blockType === 'Physical') {
      const { bay, row, tier } = this.relocateForm;
      if (bay == null || row == null || tier == null) return true;
      if (bay < 1 || row < 1 || tier < 1) return true;
      if (block.bayCount && bay > block.bayCount) return true;
      if (block.rowCount && row > block.rowCount) return true;
      if (block.tierCount && tier > block.tierCount) return true;
    }
    return false;
  }

  // Outbound
  outboundSlideOpen = false;
  outbounding = false;
  outboundForm = { orderNumber: '', outboundVehicle: '' };

  constructor(
    private route: ActivatedRoute,
    private depotService: DepotService,
    private messageService: MessageService,
    public authService: AuthService,
  ) {}

  ngOnInit() {
    this.containerNumber = this.route.snapshot.paramMap.get('containerNumber') ?? '';
    if (this.containerNumber) {
      this.loadData(this.containerNumber);
    }
    this.depotService.getYardBlocks().subscribe(blocks => {
      this.yardBlocks = blocks;
      this.yardBlockOptions = blocks.map(b => ({ label: `${b.code} (${b.blockType})`, value: b.id }));
    });
  }

  loadData(cn: string) {
    this.depotService.getContainerByNumber(cn).subscribe({
      next: (data) => this.container = data,
      error: () => this.container = null,
    });
    this.depotService.getCurrentLocation(cn).subscribe({
      next: (loc) => this.location = loc,
      error: () => this.location = null,
    });
    this.depotService.getVisitHistory(cn).subscribe(data => this.visitHistory = data);
  }

  openRelocateSlide() {
    if (!this.authService.canManageYard()) return;
    const firstPhysical = this.yardBlocks.find(b => b.blockType === 'Physical');
    this.relocateForm = {
      yardBlockId: firstPhysical?.id ?? this.yardBlocks[0]?.id ?? 0,
      bay: 1, row: 1, tier: 1, reason: '',
    };
    this.relocateSlideOpen = true;
  }

  doRelocate() {
    if (!this.authService.canManageYard()) return;
    if (!this.container) return;
    if (this.relocateFormInvalid) return;
    const block = this.selectedRelocateBlock;
    const isVirtual = block?.blockType === 'Virtual';
    this.relocating = true;
    this.depotService.relocateContainer({
      containerNumber: this.container.containerNumber,
      yardBlockId: Number(this.relocateForm.yardBlockId),
      // Physical → send concrete values (required, validated above).
      // Virtual → send undefined so backend accepts null coords (BR-CV-11).
      bay: isVirtual ? undefined : this.relocateForm.bay ?? undefined,
      row: isVirtual ? undefined : this.relocateForm.row ?? undefined,
      tier: isVirtual ? undefined : this.relocateForm.tier ?? undefined,
      classification: (this.location?.classification || ContainerGrade.A) as ContainerGrade,
      condition: (this.location?.condition || ContainerConditionStatus.Normal) as ContainerConditionStatus,
      reason: this.relocateForm.reason,
    }).subscribe({
      next: () => {
        this.relocating = false;
        this.relocateSlideOpen = false;
        this.messageService.add({ severity: 'success', summary: 'Relocated', detail: 'Container relocated successfully', life: 3000 });
        this.loadData(this.container!.containerNumber);
      },
      error: (err) => {
        this.relocating = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.Message || 'Relocate failed', life: 5000 });
      },
    });
  }

  openOutboundSlide() {
    if (!this.authService.canGateInOut()) return;
    this.outboundForm = { orderNumber: '', outboundVehicle: '' };
    this.outboundSlideOpen = true;
  }

  doOutbound() {
    if (!this.authService.canGateInOut()) return;
    if (!this.container) return;
    this.outbounding = true;
    this.depotService.outboundContainer({
      containerNumber: this.container.containerNumber,
      orderNumber: this.outboundForm.orderNumber || undefined,
      outboundVehicle: this.outboundForm.outboundVehicle,
    }).subscribe({
      next: () => {
        this.outbounding = false;
        this.outboundSlideOpen = false;
        this.messageService.add({ severity: 'success', summary: 'Outbound', detail: 'Container released successfully', life: 3000 });
        this.loadData(this.container!.containerNumber);
      },
      error: (err) => {
        this.outbounding = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.Message || 'Outbound failed', life: 5000 });
      },
    });
  }
}
