// Table-driven tests for the pure fit-to-bounds ladder (AOD-123 acceptance #4; vela-DESIGN.md §7-8).
// The ladder is host-dimension-driven and deterministic, so it is exhaustively testable without a render:
// (line heights + gap + box) in, a render/drop decision out. Cases cover value-only fits, detail kept,
// detail truncated-then-dropped, the tiny S box, the tall M box, and the W / L boxes, plus the lead hold.
import { bodyBox, CARD_PADDING, fitBody, HEADER_GAP, HEADER_HEIGHT } from '../fitLadder';

const UNIT_PX = 96; // mirror layout/geometry.ts (the AOD-122 96-DP row)

describe('fitBody: the value is held, detail truncates-then-drops for height (§7-8)', () => {
  // Each row: a scenario, the input, and the expected decision. Heights are illustrative DP.
  const value = { height: 44 }; // a hero-class value line
  const gap = 8;

  const cases: Array<{
    name: string;
    detail: number[]; // detail line heights
    boxHeight: number;
    lead?: number;
    expectDetail: boolean[];
    expectDropped: number;
    expectLead?: boolean;
  }> = [
    {
      name: 'value only, no detail: the value always renders',
      detail: [],
      boxHeight: 20, // even a box shorter than the value: the value is held, never dropped
      expectDetail: [],
      expectDropped: 0,
    },
    {
      name: 'tall box: every detail line fits',
      detail: [18, 18, 16],
      boxHeight: 144, // an L / M body: 44 + 3*(8+~18) ~= 122 <= 144
      expectDetail: [true, true, true],
      expectDropped: 0,
    },
    {
      name: 'short (1-unit) box: all detail drops, value survives (the AOD-95/97 fix)',
      detail: [18],
      boxHeight: 48, // a W / S body: 44 + 8 + 18 = 70 > 48 -> the one detail line drops
      expectDetail: [false],
      expectDropped: 1,
    },
    {
      name: 'partial fit: the first detail line fits, the rest drop bottom-up',
      detail: [18, 18, 18],
      boxHeight: 44 + 8 + 18, // room for exactly one detail line
      expectDetail: [true, false, false],
      expectDropped: 2,
    },
    {
      name: 'deterministic drop is a PREFIX: a short later line never jumps a dropped earlier one',
      detail: [40, 10, 10], // line 0 is tall and does not fit; 1 & 2 would fit alone but must still drop
      boxHeight: 44 + 8 + 20, // room for a ~20px line, but line 0 is 40 -> drops, so 1 & 2 drop too
      expectDetail: [false, false, false],
      expectDropped: 3,
    },
    {
      name: 'exact fit boundary: a line that fits to the pixel is kept (<=, not <)',
      detail: [18],
      boxHeight: 44 + 8 + 18, // 70 exactly
      expectDetail: [true],
      expectDropped: 0,
    },
    {
      name: 'lead is held and reserved before detail; detail drops around it',
      detail: [18],
      lead: 16,
      boxHeight: 44 + 8 + 16, // room for lead+value only; the detail line drops
      expectDetail: [false],
      expectDropped: 1,
      expectLead: true,
    },
    {
      name: 'lead is held even when it overflows: it is identity, not sheddable detail',
      detail: [],
      lead: 16,
      boxHeight: 30, // lead(16)+gap(8)+value(44)=68 > 30, but both are held and render anyway
      expectDetail: [],
      expectDropped: 0,
      expectLead: true,
    },
  ];

  it.each(cases)('$name', (c) => {
    const decision = fitBody({
      lead: c.lead != null ? { height: c.lead } : undefined,
      value,
      detail: c.detail.map((height) => ({ height })),
      gap,
      box: { width: 168, height: c.boxHeight },
    });
    expect(decision.detailVisible).toEqual(c.expectDetail);
    expect(decision.droppedDetail).toBe(c.expectDropped);
    expect(decision.leadVisible).toBe(c.expectLead ?? false);
  });

  it('the kept detail set is always a prefix (no holes) for any box height', () => {
    const detail = [20, 20, 20, 20].map((height) => ({ height }));
    for (let h = 40; h <= 200; h += 7) {
      const { detailVisible } = fitBody({ value, detail, gap, box: { width: 168, height: h } });
      const firstFalse = detailVisible.indexOf(false);
      if (firstFalse !== -1) {
        // everything after the first drop is also dropped
        expect(detailVisible.slice(firstFalse).every((v) => v === false)).toBe(true);
      }
    }
  });
});

describe('bodyBox: the host slot -> body px box derivation (§3 acceptance #3)', () => {
  // The four S/M/W/L slots on the 96-DP grid; the header is shown unless the leaf suppresses it.
  const chromeVWithHeader = CARD_PADDING * 2 + HEADER_HEIGHT + HEADER_GAP; // 24 + 24 = 48
  const chromeVNoHeader = CARD_PADDING * 2; // 24

  it('S (1x1) with header: 72 x 48', () => {
    expect(bodyBox(1, 1, UNIT_PX, { headerShown: true })).toEqual({ width: 96 - 24, height: 96 - chromeVWithHeader });
  });

  it('S (1x1) header suppressed (Clock): 72 x 72', () => {
    expect(bodyBox(1, 1, UNIT_PX, { headerShown: false })).toEqual({ width: 96 - 24, height: 96 - chromeVNoHeader });
  });

  it('W (2x1) with header: 168 x 48 (wide but short — the 1-unit-tall trap)', () => {
    expect(bodyBox(2, 1, UNIT_PX, { headerShown: true })).toEqual({ width: 192 - 24, height: 96 - chromeVWithHeader });
  });

  it('M (1x2) with header: 72 x 144 (narrow but tall)', () => {
    expect(bodyBox(1, 2, UNIT_PX, { headerShown: true })).toEqual({ width: 96 - 24, height: 192 - chromeVWithHeader });
  });

  it('L (2x2) with header: 168 x 144', () => {
    expect(bodyBox(2, 2, UNIT_PX, { headerShown: true })).toEqual({ width: 192 - 24, height: 192 - chromeVWithHeader });
  });

  it('clamps a degenerate slot at 0 rather than a negative extent', () => {
    expect(bodyBox(0, 0, UNIT_PX, { headerShown: true })).toEqual({ width: 0, height: 0 });
  });

  it('honours host-passed chrome overrides (theme numbers win over the defaults)', () => {
    const box = bodyBox(2, 1, UNIT_PX, { headerShown: true, padding: 10, headerHeight: 20, headerGap: 6 });
    expect(box).toEqual({ width: 192 - 20, height: 96 - 20 - 20 - 6 });
  });
});
