import Konva from 'konva';
import { Subject } from 'rxjs';
import {
  YardMapBlock,
  YardMapFacility,
  YardMapHeatmapCell,
} from '../../../core/models/depot.models';
import {
  CATEGORY_COLOR,
  FACILITY_COLOR,
  OverlayMode,
  ResolvedFill,
  occupancyRamp,
  dwellRamp,
  dim,
  resolveBlockFill,
} from '../yard-map.tokens';

const UNIT_PX = 24;
const MIN_SCALE = 0.3;
const MAX_SCALE = 3.0;
const ZOOM_STEP = 1.15;

export interface BlockClickEvent {
  blockCode: string;
  originalEvent: Konva.KonvaEventObject<MouseEvent>;
}

export interface BlockDragEndEvent {
  blockCode: string;
  canvasX: number;
  canvasY: number;
}

export interface ViewportChangeEvent {
  scale: number;
  position: { x: number; y: number };
}

/**
 * Lightweight Konva wrapper for the Yard Map overview canvas.
 * No framework coupling — the Angular component drives it via pure methods.
 */
export class KonvaYardMap {
  readonly blockClick$ = new Subject<BlockClickEvent>();
  readonly blockDragEnd$ = new Subject<BlockDragEndEvent>();
  readonly viewportChange$ = new Subject<ViewportChangeEvent>();

  private stage: Konva.Stage | null = null;
  private bgLayer: Konva.Layer | null = null;
  private blockLayer: Konva.Layer | null = null;
  private facilityLayer: Konva.Layer | null = null;
  private overlayLayer: Konva.Layer | null = null;
  private host: HTMLDivElement | null = null;
  private resizeObserver: ResizeObserver | null = null;

  private blocks: YardMapBlock[] = [];
  private facilities: YardMapFacility[] = [];
  private overlayMode: OverlayMode = 'off';
  private overlayData: YardMapHeatmapCell[] = [];
  private dimmedBlocks = new Set<string>();
  private selectedBlockCode = '';
  private editable = false;

  mount(host: HTMLDivElement): void {
    this.host = host;
    const rect = host.getBoundingClientRect();
    this.stage = new Konva.Stage({
      container: host,
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height),
      draggable: true,
    });

    this.bgLayer = new Konva.Layer();
    this.blockLayer = new Konva.Layer();
    this.facilityLayer = new Konva.Layer();
    this.overlayLayer = new Konva.Layer();
    this.stage.add(this.bgLayer, this.blockLayer, this.facilityLayer, this.overlayLayer);

    this.drawBackground();
    this.bindWheel();
    this.bindViewportEvents();
    this.bindResize(host);
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.stage?.destroy();
    this.stage = null;
    this.bgLayer = this.blockLayer = this.facilityLayer = this.overlayLayer = null;
    this.blockClick$.complete();
    this.blockDragEnd$.complete();
    this.viewportChange$.complete();
    this.host = null;
  }

  setBlocks(blocks: YardMapBlock[]): void {
    this.blocks = blocks;
    this.render();
  }

  setFacilities(facilities: YardMapFacility[]): void {
    this.facilities = facilities;
    this.renderFacilities();
  }

  setOverlay(mode: OverlayMode, cells: YardMapHeatmapCell[] = []): void {
    this.overlayMode = mode;
    this.overlayData = cells;
    this.render();
  }

  setDimmedBlocks(codes: Iterable<string>): void {
    this.dimmedBlocks = new Set(codes);
    this.render();
  }

  setSelection(blockCode: string): void {
    this.selectedBlockCode = blockCode ?? '';
    this.render();
  }

  setEditable(editable: boolean): void {
    this.editable = editable;
    this.render();
  }

  fitAll(): void {
    if (!this.stage || this.blocks.length === 0) return;
    const bounds = this.computeBounds();
    if (!bounds) return;
    const padding = UNIT_PX;
    const scaleX = (this.stage.width() - padding * 2) / Math.max(1, bounds.width * UNIT_PX);
    const scaleY = (this.stage.height() - padding * 2) / Math.max(1, bounds.height * UNIT_PX);
    const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(scaleX, scaleY)));
    this.stage.scale({ x: scale, y: scale });
    this.stage.position({
      x: padding - bounds.minX * UNIT_PX * scale,
      y: padding - bounds.minY * UNIT_PX * scale,
    });
    this.stage.batchDraw();
    this.emitViewport();
  }

  panTo(blockCode: string): void {
    if (!this.stage) return;
    const block = this.blocks.find(b => b.blockCode === blockCode);
    if (!block) return;
    const scale = this.stage.scaleX();
    const centerX = this.stage.width() / 2;
    const centerY = this.stage.height() / 2;
    const targetX = (block.canvasX + block.canvasWidth / 2) * UNIT_PX * scale;
    const targetY = (block.canvasY + block.canvasHeight / 2) * UNIT_PX * scale;
    this.stage.position({ x: centerX - targetX, y: centerY - targetY });
    this.stage.batchDraw();
    this.emitViewport();
  }

  reset(): void {
    if (!this.stage) return;
    this.stage.scale({ x: 1, y: 1 });
    this.stage.position({ x: 0, y: 0 });
    this.stage.batchDraw();
    this.emitViewport();
  }

  zoomBy(deltaFactor: number): void {
    if (!this.stage) return;
    const oldScale = this.stage.scaleX();
    const newScale = clamp(oldScale * deltaFactor, MIN_SCALE, MAX_SCALE);
    const center = { x: this.stage.width() / 2, y: this.stage.height() / 2 };
    const pointTo = {
      x: (center.x - this.stage.x()) / oldScale,
      y: (center.y - this.stage.y()) / oldScale,
    };
    this.stage.scale({ x: newScale, y: newScale });
    this.stage.position({
      x: center.x - pointTo.x * newScale,
      y: center.y - pointTo.y * newScale,
    });
    this.stage.batchDraw();
    this.emitViewport();
  }

  // ── Internal rendering ────────────────────────────────────────────────────
  private render(): void {
    if (!this.blockLayer) return;
    this.blockLayer.destroyChildren();

    for (const block of this.blocks) {
      const group = this.createBlockGroup(block);
      this.blockLayer.add(group);
    }

    this.blockLayer.batchDraw();
  }

  private renderFacilities(): void {
    if (!this.facilityLayer) return;
    this.facilityLayer.destroyChildren();

    for (const f of this.facilities) {
      const group = new Konva.Group({
        x: f.canvasX * UNIT_PX,
        y: f.canvasY * UNIT_PX,
        rotation: f.rotation ?? 0,
      });
      const fill = FACILITY_COLOR[f.kind] ?? FACILITY_COLOR[f.colorToken ?? ''] ?? '#78909C';
      group.add(new Konva.Rect({
        x: 0,
        y: 0,
        width: f.canvasWidth * UNIT_PX,
        height: f.canvasHeight * UNIT_PX,
        fill,
        opacity: 0.9,
        cornerRadius: 2,
      }));
      group.add(new Konva.Text({
        x: 6,
        y: 4,
        text: f.label,
        fontSize: 12,
        fill: 'white',
        fontStyle: 'bold',
      }));
      this.facilityLayer.add(group);
    }

    this.facilityLayer.batchDraw();
  }

  private createBlockGroup(block: YardMapBlock): Konva.Group {
    const width = block.canvasWidth * UNIT_PX;
    const height = block.canvasHeight * UNIT_PX;
    const dimmed = this.dimmedBlocks.has(block.blockCode);
    const resolved = resolveBlockFill({
      block,
      mode: this.overlayMode,
      overlayValue: this.overlayValueFor(block),
      dimmed,
    });

    // DEC-010 — core block: không cho drag, vẽ dashed border để phân biệt visual.
    const isCore = block.isCore === true;
    const group = new Konva.Group({
      x: block.canvasX * UNIT_PX,
      y: block.canvasY * UNIT_PX,
      rotation: block.rotation ?? 0,
      draggable: this.editable && !isCore,
    });

    const selected = this.selectedBlockCode === block.blockCode;
    const dashPattern: number[] | undefined =
      resolved.dashed || isCore ? [6, 4] : undefined;
    const rect = new Konva.Rect({
      x: 0,
      y: 0,
      width,
      height,
      fill: resolved.fill,
      stroke: selected ? '#1A73E8' : (isCore ? '#E65100' : resolved.stroke),
      strokeWidth: selected ? 3 : (isCore ? 2 : 1.5),
      cornerRadius: 2,
      dash: dashPattern,
    });
    group.add(rect);

    if (isCore) {
      // Small "CORE" label in top-right — complements the dashed orange border.
      group.add(new Konva.Text({
        x: Math.max(0, width - 40),
        y: 4,
        text: 'CORE',
        fontSize: 9,
        fontStyle: 'bold',
        fill: '#E65100',
      }));
    }

    // TF-05 — capacity tint overlay: amber when ≥95%, red when full.
    const ratio = block.maxCapacity && block.maxCapacity > 0
      ? block.occupiedSlots / block.maxCapacity
      : 0;
    if (ratio >= 1) {
      group.add(new Konva.Rect({
        x: 0, y: 0, width, height,
        fill: 'rgba(217, 83, 79, 0.28)',
        listening: false,
      }));
      group.add(new Konva.Text({
        x: Math.max(0, width / 2 - 16), y: Math.max(16, height / 2 - 6),
        text: 'FULL', fontSize: 11, fontStyle: 'bold', fill: '#D9534F',
      }));
    } else if (ratio >= 0.95) {
      group.add(new Konva.Rect({
        x: 0, y: 0, width, height,
        fill: 'rgba(240, 173, 78, 0.22)',
        listening: false,
      }));
    }

    group.add(new Konva.Text({
      x: 6,
      y: 4,
      text: block.blockCode,
      fontSize: 13,
      fontStyle: 'bold',
      fill: textColorFor(resolved),
    }));

    group.add(new Konva.Text({
      x: 6,
      y: Math.max(16, height - 18),
      text: `${block.occupancyPercent}% · ${block.category}`,
      fontSize: 11,
      fill: textColorFor(resolved),
    }));

    group.on('mouseenter', () => {
      if (this.host) this.host.style.cursor = 'pointer';
    });
    group.on('mouseleave', () => {
      if (this.host) this.host.style.cursor = 'grab';
    });
    group.on('click tap', originalEvent => {
      this.blockClick$.next({ blockCode: block.blockCode, originalEvent });
    });
    group.on('dragend', () => {
      const canvasX = Math.round(group.x() / UNIT_PX);
      const canvasY = Math.round(group.y() / UNIT_PX);
      this.blockDragEnd$.next({ blockCode: block.blockCode, canvasX, canvasY });
    });

    return group;
  }

  private overlayValueFor(block: YardMapBlock): number | undefined {
    if (this.overlayMode === 'off') return undefined;
    const matches = this.overlayData.filter(c => c.blockCode === block.blockCode);
    if (!matches.length) {
      return this.overlayMode === 'occupancy' ? block.occupancyPercent : 0;
    }
    if (this.overlayMode === 'occupancy') {
      const total = matches.reduce((acc, m) => acc + (m.occupancyPercent ?? 0), 0);
      return total / matches.length;
    }
    // dwell: average days across cells
    const days = matches.reduce((acc, m) => acc + (m.dwellTimeDays ?? 0), 0);
    return days / matches.length;
  }

  private computeBounds(): { minX: number; minY: number; width: number; height: number } | null {
    if (this.blocks.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const b of this.blocks) {
      minX = Math.min(minX, b.canvasX);
      minY = Math.min(minY, b.canvasY);
      maxX = Math.max(maxX, b.canvasX + b.canvasWidth);
      maxY = Math.max(maxY, b.canvasY + b.canvasHeight);
    }
    for (const f of this.facilities) {
      minX = Math.min(minX, f.canvasX);
      minY = Math.min(minY, f.canvasY);
      maxX = Math.max(maxX, f.canvasX + f.canvasWidth);
      maxY = Math.max(maxY, f.canvasY + f.canvasHeight);
    }
    return { minX, minY, width: maxX - minX, height: maxY - minY };
  }

  private drawBackground(): void {
    if (!this.bgLayer || !this.stage) return;
    this.bgLayer.destroyChildren();
    const bg = new Konva.Rect({
      x: 0,
      y: 0,
      width: this.stage.width(),
      height: this.stage.height(),
      fill: '#FAFAFA',
      listening: false,
    });
    this.bgLayer.add(bg);
    this.bgLayer.batchDraw();
  }

  private bindWheel(): void {
    if (!this.stage) return;
    this.stage.on('wheel', e => {
      e.evt.preventDefault();
      const direction = e.evt.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP;
      const oldScale = this.stage!.scaleX();
      const pointer = this.stage!.getPointerPosition();
      if (!pointer) return;
      const mousePointTo = {
        x: (pointer.x - this.stage!.x()) / oldScale,
        y: (pointer.y - this.stage!.y()) / oldScale,
      };
      const newScale = clamp(oldScale * direction, MIN_SCALE, MAX_SCALE);
      this.stage!.scale({ x: newScale, y: newScale });
      this.stage!.position({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      });
      this.stage!.batchDraw();
      this.emitViewport();
    });
  }

  private bindViewportEvents(): void {
    this.stage?.on('dragend', () => this.emitViewport());
  }

  private bindResize(host: HTMLDivElement): void {
    this.resizeObserver = new ResizeObserver(() => {
      if (!this.stage) return;
      const rect = host.getBoundingClientRect();
      this.stage.width(Math.max(1, rect.width));
      this.stage.height(Math.max(1, rect.height));
      this.drawBackground();
      this.stage.batchDraw();
    });
    this.resizeObserver.observe(host);
  }

  private emitViewport(): void {
    if (!this.stage) return;
    this.viewportChange$.next({
      scale: this.stage.scaleX(),
      position: { x: this.stage.x(), y: this.stage.y() },
    });
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function textColorFor(resolved: ResolvedFill): string {
  const hex = resolved.fill.slice(0, 7);
  if (!/^#([0-9A-Fa-f]{6})$/.test(hex)) return '#212121';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1B1B1B' : '#FFFFFF';
}

// Re-export helpers for unit tests
export const __konvaTestables = { clamp, textColorFor, occupancyRamp, dwellRamp, dim, CATEGORY_COLOR };
