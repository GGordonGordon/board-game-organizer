import { describe, expect, it } from 'vitest'
import { cavityFootprint, computeLayout, computeModules, footprintOf, shelfPack } from './packing'
import {
  DEFAULT_PRINTER,
  HEX_RATIO,
  POLYGON_SHAPES,
  type GameComponent,
  type Project,
} from '../types'

function project(overrides: Partial<Project> = {}): Project {
  return {
    name: 'Test',
    playerCount: 4,
    box: { length: 280, width: 280, height: 70 },
    components: [],
    groups: [],
    printer: { ...DEFAULT_PRINTER },
    ...overrides,
  }
}

describe('shelfPack', () => {
  it('packs items without overlap and within the bin', () => {
    const res = shelfPack(
      [
        { id: 'a', l: 100, w: 50, canRotate: true },
        { id: 'b', l: 100, w: 50, canRotate: true },
        { id: 'c', l: 60, w: 40, canRotate: true },
      ],
      220,
      220,
      2,
    )
    expect(res.unplaced).toHaveLength(0)
    expect(res.length).toBeLessThanOrEqual(220)
    expect(res.width).toBeLessThanOrEqual(220)
    for (const p of res.placed) {
      for (const q of res.placed) {
        if (p.id === q.id) continue
        const overlap =
          p.x < q.x + q.l && q.x < p.x + p.l && p.y < q.y + q.w && q.y < p.y + p.w
        expect(overlap).toBe(false)
      }
    }
  })

  it('rotates items to fit', () => {
    const res = shelfPack([{ id: 'a', l: 50, w: 150, canRotate: true }], 200, 60, 0)
    expect(res.unplaced).toHaveLength(0)
    expect(res.placed[0].l).toBe(150)
    expect(res.placed[0].w).toBe(50)
  })

  it('reports items that cannot fit', () => {
    const res = shelfPack([{ id: 'big', l: 300, w: 300, canRotate: true }], 220, 220, 0)
    expect(res.unplaced).toEqual(['big'])
  })
})

describe('footprintOf', () => {
  const base: Omit<GameComponent, 'shape'> = {
    id: 'x',
    name: 'x',
    length: 60,
    width: 40,
    thickness: 2,
    quantity: 1,
    groupId: 'g',
  }

  it('uses length × width for rectangles and cards', () => {
    expect(footprintOf({ ...base, shape: 'rect' })).toEqual({ l: 60, w: 40 })
    expect(footprintOf({ ...base, shape: 'card' })).toEqual({ l: 60, w: 40 })
  })

  it('treats circle length as diameter', () => {
    expect(footprintOf({ ...base, shape: 'circle' })).toEqual({ l: 60, w: 60 })
  })

  it('computes hex bounding box from across-flats size', () => {
    const fp = footprintOf({ ...base, shape: 'hex' })
    expect(fp.w).toBe(60)
    expect(fp.l).toBeCloseTo(60 * HEX_RATIO) // ≈ 69.3 across corners
  })

  it('defaults to rectangle for legacy data without a shape', () => {
    const legacy = { ...base } as GameComponent
    expect(footprintOf(legacy)).toEqual({ l: 60, w: 40 })
  })

  it('computes bounding boxes for the other regular polygons', () => {
    // triangle measured by side: 60 wide, 60·√3/2 deep
    const tri = footprintOf({ ...base, shape: 'triangle' })
    expect(tri.l).toBeCloseTo(60)
    expect(tri.w).toBeCloseTo(60 * 0.8660254)
    // octagon measured across flats: square bounding box
    const oct = footprintOf({ ...base, shape: 'octagon' })
    expect(oct.l).toBeCloseTo(60)
    expect(oct.w).toBeCloseTo(60)
    // pentagon/heptagon measured by width: bbox length = the measured width
    for (const shape of ['pentagon', 'heptagon'] as const) {
      const fp = footprintOf({ ...base, shape })
      expect(fp.l).toBeCloseTo(60)
      expect(fp.w).toBeLessThan(60)
      expect(fp.w).toBeGreaterThan(50)
    }
  })

  it('offsets polygon cavities outward so the inradius grows by the clearance', () => {
    const cc = 0.4
    // triangle: bbox must grow by MORE than 2·cc (pointy corners need room)
    const tri = cavityFootprint({ ...base, shape: 'triangle' }, cc)
    expect(tri.l).toBeGreaterThan(60 + 2 * cc)
    // octagon: nearly a uniform ring, just over 2·cc
    const oct = cavityFootprint({ ...base, shape: 'octagon' }, cc)
    expect(oct.l).toBeGreaterThan(60 + 2 * cc - 0.01)
    expect(oct.l).toBeLessThan(60 + 2 * cc + 0.1)
    // rectangles stay simple: +2·cc per axis
    const rect = cavityFootprint({ ...base, shape: 'rect' }, cc)
    expect(rect.l).toBeCloseTo(60 + 2 * cc)
    expect(rect.w).toBeCloseTo(40 + 2 * cc)
  })
})

describe('computeModules', () => {
  it('creates one lidded box per group with compartments per component', () => {
    const p = project({
      groups: [
        { id: 'g1', name: 'Tokens', containerType: 'lidded-box', perPlayer: false, color: '#fff' },
      ],
      components: [
        { shape: 'rect' as const, id: 'c1', name: 'Coin', length: 20, width: 20, thickness: 2, quantity: 10, groupId: 'g1' },
        { shape: 'rect' as const, id: 'c2', name: 'Gem', length: 10, width: 10, thickness: 8, quantity: 5, groupId: 'g1' },
      ],
    })
    const { modules } = computeModules(p)
    expect(modules).toHaveLength(1)
    const m = modules[0]
    expect(m.type).toBe('lidded-box')
    expect(m.hasLid).toBe(true)
    expect(m.copies).toBe(1)
    expect(m.compartments).toHaveLength(2)
    // interior depth = tallest stack (gems: 5 × 8 = 40)
    expect(m.interiorDepth).toBe(40)
    // compartment holds the piece plus clearance
    const coin = m.compartments.find((c) => c.label === 'Coin')!
    expect(coin.length).toBeCloseTo(20 + 2 * p.printer.componentClearance)
  })

  it('prints per-player modules once per player', () => {
    const p = project({
      playerCount: 3,
      groups: [
        { id: 'g1', name: 'Player bits', containerType: 'lidded-box', perPlayer: true, color: '#fff' },
      ],
      components: [
        { shape: 'rect' as const, id: 'c1', name: 'Cube', length: 8, width: 8, thickness: 8, quantity: 10, groupId: 'g1' },
      ],
    })
    const { modules } = computeModules(p)
    expect(modules).toHaveLength(1)
    expect(modules[0].copies).toBe(3)
  })

  it('splits stacks that are taller than the box', () => {
    const p = project({
      groups: [
        { id: 'g1', name: 'Coins', containerType: 'lidded-box', perPlayer: false, color: '#fff' },
      ],
      components: [
        // 30 × 2.5 = 75 mm stack in a 70 mm deep box → must split
        { shape: 'rect' as const, id: 'c1', name: 'Coin', length: 22, width: 22, thickness: 2.5, quantity: 30, groupId: 'g1' },
      ],
    })
    const { modules } = computeModules(p)
    const m = modules[0]
    expect(m.compartments.length).toBeGreaterThan(1)
    expect(m.compartments.reduce((s, c) => s + c.quantity, 0)).toBe(30)
    expect(m.packedHeight).toBeLessThanOrEqual(70)
  })

  it('sizes a rectangular tray around a hex tile stack with a hex recess', () => {
    const p = project({
      groups: [
        { id: 'g1', name: 'Hexes', containerType: 'stack-tray', perPlayer: false, color: '#fff' },
      ],
      components: [
        { shape: 'hex' as const, id: 'c1', name: 'Hex tile', length: 60, width: 60, thickness: 2, quantity: 20, groupId: 'g1' },
      ],
    })
    const { modules } = computeModules(p)
    const m = modules[0]
    const cc = p.printer.componentClearance
    const wall = p.printer.wallThickness
    // outer footprint wraps the offset hex bounding box (across corners × across flats)
    const cav = cavityFootprint(p.components[0], cc)
    expect(cav.l).toBeCloseTo(cav.w * HEX_RATIO)
    expect(m.outer.length).toBeCloseTo(cav.l + 2 * wall)
    expect(m.outer.width).toBeCloseTo(cav.w + 2 * wall)
    const c = m.compartments[0]
    expect(c.shape).toBe('hex')
    expect(c.shapeDim).toBe(60) // measured dim; clearance is applied in geometry
  })

  it('records circle recesses with their clearanced diameter', () => {
    const p = project({
      groups: [
        { id: 'g1', name: 'Tokens', containerType: 'lidded-box', perPlayer: false, color: '#fff' },
      ],
      components: [
        { shape: 'circle' as const, id: 'c1', name: 'Disc', length: 30, width: 30, thickness: 3, quantity: 8, groupId: 'g1' },
      ],
    })
    const { modules } = computeModules(p)
    const c = modules[0].compartments[0]
    expect(c.shape).toBe('circle')
    expect(c.shapeDim).toBe(30) // diameter; clearance is applied in geometry
    expect(c.length).toBeCloseTo(30 + 2 * p.printer.componentClearance)
    expect(c.length).toBeCloseTo(c.width) // circular recess has a square bbox
  })

  it('builds shaped compartments for every polygon type', () => {
    const shapes = Object.keys(POLYGON_SHAPES) as (keyof typeof POLYGON_SHAPES)[]
    const p = project({
      groups: [
        { id: 'g1', name: 'Tokens', containerType: 'lidded-box', perPlayer: false, color: '#fff' },
      ],
      components: shapes.map((shape, i) => ({
        shape,
        id: `c${i}`,
        name: shape,
        length: 30,
        width: 30,
        thickness: 3,
        quantity: 5,
        groupId: 'g1',
      })),
    })
    const { modules } = computeModules(p)
    expect(modules).toHaveLength(1)
    expect(modules[0].compartments).toHaveLength(shapes.length)
    for (const c of modules[0].compartments) {
      expect(shapes).toContain(c.shape)
      expect(c.shapeDim).toBe(30)
    }
  })

  it('pivots pieces on edge in a well (opening on the side of the stack)', () => {
    const p = project({
      groups: [
        { id: 'g1', name: 'Deck', containerType: 'well', perPlayer: false, color: '#fff' },
      ],
      components: [
        // 40 standard American cards: 56 × 87, 0.3 thick → 12 mm stack
        { shape: 'card' as const, id: 'c1', name: 'Cards', length: 56, width: 87, thickness: 0.3, quantity: 40, groupId: 'g1' },
      ],
    })
    const { modules } = computeModules(p)
    expect(modules).toHaveLength(1)
    const m = modules[0]
    const s = p.printer
    expect(m.type).toBe('well')
    // 87 won't stand in a 70 mm box → cards stand on their long edge, 56 up
    expect(m.outer.height).toBeCloseTo(s.floorThickness + 56)
    // stack runs horizontally: cavity length = 12 mm of cards + clearance
    expect(m.compartments[0].length).toBeCloseTo(40 * 0.3 + 2 * s.componentClearance)
    expect(m.compartments[0].width).toBeCloseTo(87 + 2 * s.componentClearance)
    expect(m.compartments[0].depth).toBe(56)
  })

  it('stands pieces fully upright in a well when the box is deep enough', () => {
    const p = project({
      box: { length: 280, width: 280, height: 100 },
      groups: [
        { id: 'g1', name: 'Deck', containerType: 'well', perPlayer: false, color: '#fff' },
      ],
      components: [
        { shape: 'card' as const, id: 'c1', name: 'Cards', length: 56, width: 87, thickness: 0.3, quantity: 40, groupId: 'g1' },
      ],
    })
    const { modules } = computeModules(p)
    expect(modules[0].outer.height).toBeCloseTo(p.printer.floorThickness + 87)
    expect(modules[0].compartments[0].width).toBeCloseTo(56 + 2 * p.printer.componentClearance)
  })

  it('grows modules to their size override and recentres contents', () => {
    const p = project({
      groups: [
        { id: 'g1', name: 'Tokens', containerType: 'lidded-box', perPlayer: false, color: '#fff' },
        { id: 'g2', name: 'Tiles', containerType: 'stack-tray', perPlayer: false, color: '#fff' },
      ],
      components: [
        { shape: 'rect' as const, id: 'c1', name: 'Coin', length: 20, width: 20, thickness: 2, quantity: 10, groupId: 'g1' },
        { shape: 'rect' as const, id: 'c2', name: 'Tile', length: 60, width: 60, thickness: 2, quantity: 10, groupId: 'g2' },
      ],
    })
    const base = computeModules(p).modules
    const lidBase = base.find((m) => m.type === 'lidded-box')!
    const trayBase = base.find((m) => m.type === 'stack-tray')!

    p.moduleSizes = {
      [lidBase.id]: { length: lidBase.outer.length + 20, height: lidBase.outer.height + 10 },
      [trayBase.id]: { width: 100, length: 1 }, // length below minimum → ignored
    }
    const { modules } = computeModules(p)
    const lid = modules.find((m) => m.type === 'lidded-box')!
    const tray = modules.find((m) => m.type === 'stack-tray')!

    expect(lid.outer.length).toBeCloseTo(lidBase.outer.length + 20)
    expect(lid.outer.height).toBeCloseTo(lidBase.outer.height + 10)
    expect(lid.packedHeight).toBeCloseTo(lidBase.packedHeight + 10)
    // compartments recentred: shifted by half the growth
    expect(lid.compartments[0].x).toBeCloseTo(lidBase.compartments[0].x + 10)

    expect(tray.outer.width).toBeCloseTo(100)
    expect(tray.outer.length).toBeCloseTo(trayBase.outer.length) // grow-only
  })

  it('sizes a stack tray from the tile stack', () => {
    const p = project({
      groups: [
        { id: 'g1', name: 'Tiles', containerType: 'stack-tray', perPlayer: false, color: '#fff' },
      ],
      components: [
        { shape: 'rect' as const, id: 'c1', name: 'Tile', length: 60, width: 60, thickness: 2, quantity: 30, groupId: 'g1' },
      ],
    })
    const { modules } = computeModules(p)
    expect(modules).toHaveLength(1)
    const m = modules[0]
    expect(m.type).toBe('stack-tray')
    expect(m.hasLid).toBe(false)
    expect(m.outer.height).toBeCloseTo(p.printer.floorThickness + 60)
  })
})

describe('computeLayout', () => {
  const fullProject = project({
    playerCount: 4,
    groups: [
      { id: 'g1', name: 'Player bits', containerType: 'lidded-box', perPlayer: true, color: '#f00' },
      { id: 'g2', name: 'Tiles', containerType: 'stack-tray', perPlayer: false, color: '#0f0' },
    ],
    components: [
      { shape: 'rect' as const, id: 'c1', name: 'Cube', length: 8, width: 8, thickness: 8, quantity: 10, groupId: 'g1' },
      { shape: 'rect' as const, id: 'c2', name: 'Meeple', length: 16, width: 16, thickness: 10, quantity: 6, groupId: 'g1' },
      { shape: 'rect' as const, id: 'c3', name: 'Tile', length: 60, width: 60, thickness: 2, quantity: 25, groupId: 'g2' },
    ],
  })

  it('places every module instance inside the box footprint', () => {
    const res = computeLayout(fullProject)
    expect(res.fits).toBe(true)
    // at least 4 player boxes + 1 tray (stack splitting may add more modules)
    expect(res.instances.length).toBeGreaterThanOrEqual(5)
    for (const inst of res.instances) {
      expect(inst.x).toBeGreaterThanOrEqual(0)
      expect(inst.y).toBeGreaterThanOrEqual(0)
      expect(inst.x + inst.length).toBeLessThanOrEqual(fullProject.box.length + 0.001)
      expect(inst.y + inst.width).toBeLessThanOrEqual(fullProject.box.width + 0.001)
      expect(inst.z + inst.height).toBeLessThanOrEqual(fullProject.box.height + 0.001)
    }
  })

  it('does not overlap instances within a layer', () => {
    const res = computeLayout(fullProject)
    for (const a of res.instances) {
      for (const b of res.instances) {
        if (a.id === b.id || a.layer !== b.layer) continue
        const overlap =
          a.x < b.x + b.length - 0.001 &&
          b.x < a.x + a.length - 0.001 &&
          a.y < b.y + b.width - 0.001 &&
          b.y < a.y + a.width - 0.001
        expect(overlap).toBe(false)
      }
    }
  })

  it('keeps identical per-player boxes as a single print variant when placed identically', () => {
    const res = computeLayout(fullProject)
    const playerVariants = res.variants.filter((v) => v.moduleId === 'g1')
    const total = playerVariants.reduce((s, v) => s + v.count, 0)
    expect(total).toBe(4)
  })

  it('spreads tall stacks across the floor instead of building one tall tower', () => {
    // one 60 mm stack of tiles in a wide 280×280×70 box: splitting into two
    // side-by-side trays covers more floor and halves the height
    const p = project({
      groups: [
        { id: 'g1', name: 'Tiles', containerType: 'stack-tray', perPlayer: false, color: '#0f0' },
      ],
      components: [
        { shape: 'rect' as const, id: 'c1', name: 'Tile', length: 60, width: 60, thickness: 2, quantity: 30, groupId: 'g1' },
      ],
    })
    const res = computeLayout(p)
    expect(res.fits).toBe(true)
    expect(res.instances.length).toBeGreaterThan(1)
    expect(res.layers).toHaveLength(1) // side by side, not stacked
    expect(res.usedHeight).toBeLessThan(40)
  })

  it('reports floor coverage', () => {
    const res = computeLayout(fullProject)
    expect(res.floorCoverage).toBeGreaterThan(0)
    expect(res.floorCoverage).toBeLessThanOrEqual(1)
  })

  it('generates spacers that fill the floor plan edge to edge', () => {
    const res = computeLayout(fullProject)
    const spacers = res.modules.filter((m) => m.type === 'spacer')
    expect(spacers.length).toBeGreaterThan(0)
    // content + spacers should tile each layer completely
    const area = res.instances.reduce((s, i) => s + i.length * i.width, 0)
    const boxArea = fullProject.box.length * fullProject.box.width
    expect(area / (res.layers.length * boxArea)).toBeGreaterThan(0.999)
  })

  it('splits oversized spacers into sections that fit the print bed', () => {
    // 280 mm box on a 220 mm bed: the full-width spacer must split
    const res = computeLayout(fullProject)
    const spacerIds = new Set(res.modules.filter((m) => m.type === 'spacer').map((m) => m.id))
    expect(spacerIds.size).toBeGreaterThan(0)
    const { bedLength, bedWidth } = fullProject.printer
    const bedMax = Math.max(bedLength, bedWidth)
    const bedMin = Math.min(bedLength, bedWidth)
    let sawSplit = false
    for (const v of res.variants) {
      if (!spacerIds.has(v.moduleId)) continue
      expect(Math.max(v.outer.length, v.outer.width)).toBeLessThanOrEqual(bedMax)
      expect(Math.min(v.outer.length, v.outer.width)).toBeLessThanOrEqual(bedMin)
      if (v.count > 1) sawSplit = true
    }
    expect(sawSplit).toBe(true)
  })

  it('syncs module heights within each layer when the sync button is on', () => {
    const p = {
      ...fullProject,
      printer: { ...fullProject.printer, syncModuleHeights: true },
    }
    const res = computeLayout(p)
    for (const inst of res.instances) {
      expect(inst.height).toBeCloseTo(res.layers[inst.layer].height)
    }
    // raised modules become print variants with extra height
    expect(res.variants.some((v) => v.extra.height > 0.05)).toBe(true)
  })

  it('keeps original module heights by default (sync is opt-in)', () => {
    const res = computeLayout(fullProject)
    expect(res.instances.some((i) => i.height < res.layers[i.layer].height - 0.001)).toBe(true)
    expect(res.variants.every((v) => v.extra.height < 0.05)).toBe(true)
  })

  it('does not generate spacers when the option is off', () => {
    const p = {
      ...fullProject,
      printer: { ...fullProject.printer, generateSpacers: false },
    }
    const res = computeLayout(p)
    expect(res.modules.filter((m) => m.type === 'spacer')).toHaveLength(0)
  })

  it('respects manual placements and warns (not fails) above box height', () => {
    const p = project({
      groups: [
        { id: 'g1', name: 'Tiles', containerType: 'stack-tray', perPlayer: false, color: '#0f0' },
      ],
      components: [
        { shape: 'rect' as const, id: 'c1', name: 'Tile', length: 60, width: 60, thickness: 2, quantity: 20, groupId: 'g1' },
      ],
      manualLayout: {
        targetLayers: 1,
        // 41.2 mm tray placed at z=40 → tops out at 81.2 in a 70 mm box
        positions: { 'g1:c1:1#0': { x: 10, y: 20, z: 40, rotated: false } },
      },
    })
    const res = computeLayout(p)
    expect(res.mode).toBe('manual')
    const inst = res.instances.find((i) => i.id === 'g1:c1:1#0')!
    expect(inst.x).toBe(10)
    expect(inst.y).toBe(20)
    expect(inst.z).toBe(40)
    expect(res.usedHeight).toBeGreaterThan(p.box.height)
    expect(res.warnings.some((w) => w.includes('above the box interior'))).toBe(true)
    expect(res.fits).toBe(true) // height overflow warns but does not fail the fit
  })

  it('fills the free floor around a manual arrangement with spacers', () => {
    const p = project({
      groups: [
        { id: 'g1', name: 'Tiles', containerType: 'stack-tray', perPlayer: false, color: '#0f0' },
      ],
      components: [
        { shape: 'rect' as const, id: 'c1', name: 'Tile', length: 60, width: 60, thickness: 2, quantity: 20, groupId: 'g1' },
      ],
      manualLayout: {
        targetLayers: 1,
        positions: { 'g1:c1:1#0': { x: 100, y: 100, z: 0, rotated: false } }, // middle of the box
      },
    })
    const res = computeLayout(p)
    const spacers = res.modules.filter((m) => m.type === 'spacer')
    expect(spacers.length).toBeGreaterThan(0)
    // spacers must not overlap the tray or each other
    for (const a of res.instances) {
      for (const b of res.instances) {
        if (a.id === b.id) continue
        expect(
          a.x < b.x + b.length - 0.01 &&
            b.x < a.x + a.length - 0.01 &&
            a.y < b.y + b.width - 0.01 &&
            b.y < a.y + a.width - 0.01,
        ).toBe(false)
      }
    }
    // tray + spacers tile nearly the whole floor
    const area = res.instances.reduce((s, i) => s + i.length * i.width, 0)
    expect(area / (p.box.length * p.box.width)).toBeGreaterThan(0.95)
  })

  it('flags overlapping manual placements and fails the fit', () => {
    const p = project({
      groups: [
        { id: 'g1', name: 'A', containerType: 'stack-tray', perPlayer: false, color: '#0f0' },
        { id: 'g2', name: 'B', containerType: 'stack-tray', perPlayer: false, color: '#00f' },
      ],
      components: [
        { shape: 'rect' as const, id: 'c1', name: 'Tile', length: 60, width: 60, thickness: 2, quantity: 10, groupId: 'g1' },
        { shape: 'rect' as const, id: 'c2', name: 'Card', length: 60, width: 60, thickness: 2, quantity: 10, groupId: 'g2' },
      ],
      printer: { ...DEFAULT_PRINTER, generateSpacers: false },
      manualLayout: {
        targetLayers: 1,
        positions: {
          'g1:c1:1#0': { x: 0, y: 0, z: 0, rotated: false },
          'g2:c2:1#0': { x: 30, y: 30, z: 0, rotated: false }, // overlaps the first
        },
      },
    })
    const res = computeLayout(p)
    expect(res.fits).toBe(false)
    expect(res.warnings.some((w) => w.includes('overlap'))).toBe(true)
  })

  it('finds a free floor spot for modules added after manual arrangement', () => {
    const p = project({
      groups: [
        { id: 'g1', name: 'A', containerType: 'stack-tray', perPlayer: false, color: '#0f0' },
        { id: 'g2', name: 'B', containerType: 'stack-tray', perPlayer: false, color: '#00f' },
      ],
      components: [
        { shape: 'rect' as const, id: 'c1', name: 'Tile', length: 60, width: 60, thickness: 2, quantity: 10, groupId: 'g1' },
        { shape: 'rect' as const, id: 'c2', name: 'Card', length: 60, width: 60, thickness: 2, quantity: 10, groupId: 'g2' },
      ],
      printer: { ...DEFAULT_PRINTER, generateSpacers: false },
      manualLayout: {
        targetLayers: 1,
        positions: { 'g1:c1:1#0': { x: 0, y: 0, z: 0, rotated: false } }, // g2 has no position
      },
    })
    const res = computeLayout(p)
    expect(res.fits).toBe(true)
    expect(res.instances).toHaveLength(2)
  })

  it('honours stored spacer merges and warns when the combined piece exceeds the bed', () => {
    const mergeRects = [
      { x: 100, y: 0, l: 180, w: 140 },
      { x: 100, y: 140, l: 180, w: 140 },
    ]
    const p = project({
      groups: [
        { id: 'g1', name: 'Tiles', containerType: 'stack-tray', perPlayer: false, color: '#0f0' },
      ],
      components: [
        { shape: 'rect' as const, id: 'c1', name: 'Tile', length: 60, width: 60, thickness: 2, quantity: 20, groupId: 'g1' },
      ],
      manualLayout: {
        targetLayers: 1,
        positions: { 'g1:c1:1#0': { x: 0, y: 0, z: 0, rotated: false } },
      },
      spacerMerges: [{ id: 'merge:test', z: 0, rects: mergeRects }],
    })
    const res = computeLayout(p)
    const merged = res.modules.find((m) => m.id === 'merge:test')
    expect(merged).toBeTruthy()
    expect(merged!.type).toBe('spacer')
    expect(merged!.rects).toHaveLength(2)
    expect(merged!.outer.length).toBeCloseTo(180)
    expect(merged!.outer.width).toBeCloseTo(280)
    // bounding box 180 × 280 exceeds the default 220 × 220 bed → warning
    expect(res.warnings.some((w) => w.includes('Combined spacer'))).toBe(true)
    // auto spacers must not claim the merged area
    for (const inst of res.instances) {
      if (!inst.moduleId.startsWith('spacer:')) continue
      for (const r of mergeRects) {
        const overlap =
          inst.x < r.x + r.l - 0.01 &&
          r.x < inst.x + inst.length - 0.01 &&
          inst.y < r.y + r.w - 0.01 &&
          r.y < inst.y + inst.width - 0.01
        expect(overlap).toBe(false)
      }
    }
  })

  it('drops a merge whose area is no longer free', () => {
    const p = project({
      groups: [
        { id: 'g1', name: 'Tiles', containerType: 'stack-tray', perPlayer: false, color: '#0f0' },
      ],
      components: [
        { shape: 'rect' as const, id: 'c1', name: 'Tile', length: 60, width: 60, thickness: 2, quantity: 20, groupId: 'g1' },
      ],
      manualLayout: {
        targetLayers: 1,
        positions: { 'g1:c1:1#0': { x: 0, y: 0, z: 0, rotated: false } },
      },
      // overlaps the tray sitting at the origin → invalid
      spacerMerges: [{ id: 'merge:test', z: 0, rects: [{ x: 0, y: 0, l: 100, w: 100 }] }],
    })
    const res = computeLayout(p)
    expect(res.modules.some((m) => m.id === 'merge:test')).toBe(false)
    // the area is still tiled by regular auto spacers
    const area = res.instances.reduce((s, i) => s + i.length * i.width, 0)
    expect(area / (p.box.length * p.box.width)).toBeGreaterThan(0.95)
  })

  it('applies a rotated manual placement', () => {
    const p = project({
      groups: [
        { id: 'g1', name: 'Deck', containerType: 'well', perPlayer: false, color: '#fff' },
      ],
      components: [
        { shape: 'card' as const, id: 'c1', name: 'Cards', length: 56, width: 87, thickness: 0.3, quantity: 40, groupId: 'g1' },
      ],
      manualLayout: {
        targetLayers: 1,
        positions: { 'g1:c1:1#0': { x: 0, y: 0, z: 0, rotated: true } },
      },
    })
    const res = computeLayout(p)
    const inst = res.instances.find((i) => i.id === 'g1:c1:1#0')!
    const mod = res.modules.find((m) => m.id === 'g1:c1:1')!
    expect(inst.rotated).toBe(true)
    expect(inst.length).toBeCloseTo(mod.outer.width)
    expect(inst.width).toBeCloseTo(mod.outer.length)
  })

  it('flags a project that cannot fit', () => {
    const p = project({
      box: { length: 100, width: 100, height: 30 },
      groups: [
        { id: 'g1', name: 'Tiles', containerType: 'stack-tray', perPlayer: false, color: '#0f0' },
      ],
      components: [
        { shape: 'rect' as const, id: 'c1', name: 'Tile', length: 120, width: 120, thickness: 2, quantity: 10, groupId: 'g1' },
      ],
    })
    const res = computeLayout(p)
    expect(res.fits).toBe(false)
    expect(res.warnings.length).toBeGreaterThan(0)
  })
})
