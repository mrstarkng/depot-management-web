import { YardBlockCategory, YardMapBlock } from '../../core/models/depot.models';
import { CATEGORY_COLOR, occupancyRamp, dwellRamp, resolveBlockFill } from './yard-map.tokens';

function block(partial: Partial<YardMapBlock> = {}): YardMapBlock {
  return {
    id: 1,
    blockCode: 'A1',
    blockName: 'A1',
    bayCount: 10, rowCount: 6, tierCount: 4,
    occupiedSlots: 0, occupancyPercent: 0,
    canvasX: 0, canvasY: 0, canvasWidth: 10, canvasHeight: 6,
    rotation: 0,
    category: YardBlockCategory.Standard,
    colorOverride: null,
    rowVersion: null,
    ...partial,
  };
}

describe('yard-map tokens', () => {
  it('uses colorOverride when mode is off and override is valid hex', () => {
    const r = resolveBlockFill({ block: block({ colorOverride: '#123456' }), mode: 'off' });
    expect(r.fill).toBe('#123456');
  });

  it('falls back to category color when override is invalid', () => {
    const r = resolveBlockFill({ block: block({ colorOverride: 'not-a-color' }), mode: 'off' });
    expect(r.fill).toBe(CATEGORY_COLOR[YardBlockCategory.Standard]);
  });

  it('marks Future category with dashed flag', () => {
    const r = resolveBlockFill({ block: block({ category: YardBlockCategory.Future }), mode: 'off' });
    expect(r.dashed).toBeTrue();
  });

  it('uses occupancy ramp in occupancy mode', () => {
    const r = resolveBlockFill({ block: block(), mode: 'occupancy', overlayValue: 95 });
    expect(r.fill).toBe(occupancyRamp(95));
  });

  it('uses dwell ramp in dwell mode', () => {
    const r = resolveBlockFill({ block: block(), mode: 'dwell', overlayValue: 10 });
    expect(r.fill).toBe(dwellRamp(10));
  });

  it('dims fill when dimmed flag is set', () => {
    const r = resolveBlockFill({ block: block(), mode: 'off', dimmed: true });
    expect(r.fill).toContain(CATEGORY_COLOR[YardBlockCategory.Standard]);
    expect(r.fill.endsWith('40')).toBeTrue();
  });

  it('occupancy ramp buckets: green <50, yellow 50-80, orange 80-90, red >90', () => {
    expect(occupancyRamp(0)).toBe('#66BB6A');
    expect(occupancyRamp(49)).toBe('#66BB6A');
    expect(occupancyRamp(50)).toBe('#FBC02D');
    expect(occupancyRamp(79)).toBe('#FBC02D');
    expect(occupancyRamp(85)).toBe('#F57C00');
    expect(occupancyRamp(99)).toBe('#D32F2F');
  });

  it('dwell ramp buckets', () => {
    expect(dwellRamp(1)).toBe('#42A5F5');
    expect(dwellRamp(5)).toBe('#26A69A');
    expect(dwellRamp(10)).toBe('#FFB300');
    expect(dwellRamp(20)).toBe('#EF5350');
    expect(dwellRamp(40)).toBe('#B71C1C');
  });
});
