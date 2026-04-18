import { YardBlockCategory, YardMapBlock } from '../../core/models/depot.models';

/** Suggested palette from backend handoff §3 — frontend owns final tokens. */
export const CATEGORY_COLOR: Record<YardBlockCategory, string> = {
  [YardBlockCategory.Standard]: '#2196F3',
  [YardBlockCategory.Reefer]: '#00BCD4',
  [YardBlockCategory.OOG]: '#9C27B0',
  [YardBlockCategory.Hazardous]: '#FF9800',
  [YardBlockCategory.Damaged]: '#F44336',
  [YardBlockCategory.Empty]: '#8BC34A',
  [YardBlockCategory.Repair]: '#795548',
  [YardBlockCategory.Inspection]: '#607D8B',
  [YardBlockCategory.Bonded]: '#3F51B5',
  [YardBlockCategory.Service]: '#9E9E9E',
  [YardBlockCategory.Future]: '#CFD8DC',
};

export const FACILITY_COLOR: Record<string, string> = {
  Gate: '#388E3C',
  Admin: '#1976D2',
};

export type OverlayMode = 'off' | 'occupancy' | 'dwell';

export interface ResolvedFill {
  fill: string;
  /** Future category uses dashed stroke to show "planned" intent. */
  dashed: boolean;
  stroke: string;
}

export interface ResolveFillInput {
  block: YardMapBlock;
  mode: OverlayMode;
  /** Overlay numeric value for this block when mode !== 'off'. */
  overlayValue?: number;
  dimmed?: boolean;
}

/**
 * Precedence when mode === 'off':
 *   colorOverride (valid hex) > category color.
 * When mode === 'occupancy' or 'dwell':
 *   heat ramp based on overlayValue (percentage or days respectively).
 */
export function resolveBlockFill({ block, mode, overlayValue, dimmed }: ResolveFillInput): ResolvedFill {
  let fill: string;
  if (mode === 'off') {
    fill = pickCategoryColor(block);
  } else if (mode === 'occupancy') {
    fill = occupancyRamp(overlayValue ?? block.occupancyPercent ?? 0);
  } else {
    fill = dwellRamp(overlayValue ?? 0);
  }

  return {
    fill: dimmed ? dim(fill) : fill,
    stroke: strokeForCategory(block.category),
    dashed: block.category === YardBlockCategory.Future,
  };
}

export function pickCategoryColor(block: YardMapBlock): string {
  const overrideValid = block.colorOverride && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(block.colorOverride);
  if (overrideValid) {
    return block.colorOverride!;
  }
  return CATEGORY_COLOR[block.category] ?? CATEGORY_COLOR[YardBlockCategory.Standard];
}

export function strokeForCategory(category: YardBlockCategory): string {
  if (category === YardBlockCategory.Damaged) return '#C62828';
  if (category === YardBlockCategory.Future) return '#90A4AE';
  return 'rgba(0,0,0,0.35)';
}

export function occupancyRamp(percent: number): string {
  // green <50, yellow 50-80, orange 80-90, red >90
  if (percent > 90) return '#D32F2F';
  if (percent >= 80) return '#F57C00';
  if (percent >= 50) return '#FBC02D';
  return '#66BB6A';
}

export function dwellRamp(days: number): string {
  // blue < 3 days, teal < 7, amber < 14, red < 30, dark red >=30
  if (days >= 30) return '#B71C1C';
  if (days >= 14) return '#EF5350';
  if (days >= 7) return '#FFB300';
  if (days >= 3) return '#26A69A';
  return '#42A5F5';
}

export function dim(hex: string): string {
  // 25% opacity approximation: append alpha
  const normalized = expandHex(hex);
  return `${normalized}40`;
}

function expandHex(hex: string): string {
  if (/^#([0-9A-Fa-f]{3})$/.test(hex)) {
    const v = hex.slice(1);
    return `#${v[0]}${v[0]}${v[1]}${v[1]}${v[2]}${v[2]}`;
  }
  return hex.slice(0, 7);
}
