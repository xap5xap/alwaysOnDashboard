// Table-driven tests for the pure fit-to-bounds ladder (AOD-123 acceptance #4; vela-DESIGN.md §7-8).
// The ladder is host-dimension-driven and deterministic, so it is exhaustively testable without a render:
// (line heights + gap + box) in, a render/drop decision out. Cases cover value-only fits, detail kept,
// detail truncated-then-dropped, the tiny S box, the tall M box, and the W / L boxes, plus the lead hold.
import {
  bodyBox,
  CARD_PADDING,
  fitBody,
  fitCount,
  fitValueScale,
  HEADER_GAP,
  HEADER_HEIGHT,
  tabularWidth,
} from '../fitLadder';

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

describe('tabularWidth: a DP width estimate for a value string (over-estimates, never under)', () => {
  it('scales linearly with the font size', () => {
    expect(tabularWidth('18:45', 68)).toBeCloseTo(tabularWidth('18:45', 34) * 2, 5);
  });

  it('a digit is wider than a colon (tabular figures dominate the advance)', () => {
    expect(tabularWidth('8', 40)).toBeGreaterThan(tabularWidth(':', 40));
  });

  it('counts every glyph (a longer string is wider)', () => {
    expect(tabularWidth('18:45:30', 34)).toBeGreaterThan(tabularWidth('18:45', 34));
  });

  it('handles money and uppercase (AM/PM) glyphs', () => {
    expect(tabularWidth('$1,234.56', 40)).toBeGreaterThan(0);
    expect(tabularWidth('6:45 PM', 34)).toBeGreaterThan(tabularWidth('6:45', 34)); // the space + P + M add width
  });
});

describe('fitValueScale: the AOD-97 min(width,height) hero fit — never overflow either axis', () => {
  const lineFactor = 1.18;

  it('returns 1 when the value already fits the box (no upscaling)', () => {
    const scale = fitValueScale({ width: 40, height: 30 }, { width: 168, height: 144 }, 0.35);
    expect(scale).toBe(1);
  });

  it('AOD-95: the Clock time that CLIPS at S (34px in a 72px body) scales down to fit the width', () => {
    // "18:45" at clockSize.small 34 over-estimates to ~96px — wider than the 72px S body -> it would clip.
    const base = 34;
    const width = tabularWidth('18:45', base); // ~96
    expect(width).toBeGreaterThan(72); // proves the clip the fix removes
    const box = { width: 72, height: 72 }; // S body, header suppressed
    const scale = fitValueScale({ width, height: base * lineFactor }, box, 0.35);
    expect(scale).toBeLessThan(1); // it scaled DOWN
    expect(width * scale).toBeLessThanOrEqual(box.width + 0.001); // and now fits the width — no clip
  });

  it('AOD-97: a tall/narrow M cell is WIDTH-bound — the time fits the width instead of overflowing it', () => {
    // The repro: a tall/narrow cell would scale the time to the HEIGHT and overflow the WIDTH. min-fit
    // makes the WIDTH the binding axis, so it never overflows sideways.
    const base = 56; // clockSize.medium (the coerced-M bridge)
    const width = tabularWidth('18:45', base); // ~158, far wider than a 72px column
    const box = { width: 72, height: 144 }; // M body: narrow + tall
    const widthScale = box.width / width;
    const heightScale = box.height / (base * lineFactor);
    expect(widthScale).toBeLessThan(heightScale); // width is the binding axis
    const scale = fitValueScale({ width, height: base * lineFactor }, box, 0.35);
    expect(scale).toBeCloseTo(widthScale, 5); // min-fit picks the width scale
    expect(width * scale).toBeLessThanOrEqual(box.width + 0.001); // no horizontal overflow
  });

  it('is height-bound when the value is tall for a short-wide cell', () => {
    const base = 40;
    const box = { width: 168, height: 24 }; // wide but very short
    const scale = fitValueScale({ width: tabularWidth('$4.00', base), height: base * lineFactor }, box, 0.3);
    expect(scale).toBeCloseTo(box.height / (base * lineFactor), 5);
  });

  it('floors at minScale (legibility) rather than going infinitesimal', () => {
    const scale = fitValueScale({ width: 1000, height: 1000 }, { width: 10, height: 10 }, 0.4);
    expect(scale).toBe(0.4);
  });

  it('treats a non-positive intrinsic as nothing-to-fit (scale 1)', () => {
    expect(fitValueScale({ width: 0, height: 0 }, { width: 50, height: 50 }, 0.4)).toBe(1);
  });
});

describe('fitCount: a list never overflows — rows shed into "+N more" by HEIGHT (§8 audit)', () => {
  it('returns every row when they all fit (no footer reservation)', () => {
    // 3 rows of 20 + gaps in a 144px box under an 18px count line: all fit.
    expect(fitCount(3, 144, { rowHeight: 20, gap: 6, leadHeight: 18 })).toBe(3);
  });

  it('My Issues W (2x1): a 48px body under a count line seats far fewer than the fixed 4 (the clip fix)', () => {
    // count 22 + gap 6 + footer -> essentially no room for rows in a 48px cell; the card shows the count
    // + "+N more" instead of overflowing with 4 rows. The point: the height-driven count is < the old fixed 4.
    const n = fitCount(4, 48, { rowHeight: 20, gap: 6, leadHeight: 22, footerHeight: 16 });
    expect(n).toBeGreaterThanOrEqual(0);
    expect(n).toBeLessThan(4); // fewer than the old fixed count -> no overflow

    // A taller M (1x2, ~144px body) seats several rows but still far fewer than the old fixed 10.
    const m = fitCount(10, 144, { rowHeight: 20, gap: 6, leadHeight: 22, footerHeight: 16 });
    expect(m).toBeGreaterThan(1);
    expect(m).toBeLessThan(10);
  });

  it('reserves a footer row when the data overflows so "+N more" itself never clips', () => {
    // Without a footer, 5 rows of 20+gap6 fit ~ (144+6)/26 = 5; the footer reservation drops it to 4.
    const withFooter = fitCount(10, 144, { rowHeight: 20, gap: 6, footerHeight: 18 });
    const noFooter = fitCount(10, 144, { rowHeight: 20, gap: 6 });
    expect(withFooter).toBeLessThan(noFooter);
  });

  it('never returns more than the total, and never negative', () => {
    expect(fitCount(2, 1000, { rowHeight: 20, gap: 6 })).toBe(2);
    expect(fitCount(0, 1000, { rowHeight: 20, gap: 6 })).toBe(0);
    expect(fitCount(5, 5, { rowHeight: 20, gap: 6, leadHeight: 30 })).toBe(0); // no room at all
  });
});
