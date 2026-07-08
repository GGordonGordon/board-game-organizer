import {
  POLYGON_SHAPES,
  isPolygon,
  type ContainerType,
  type GameComponent,
  type PieceShape,
  type PrinterSettings,
  type Project,
  type SpacerMerge,
  type SpacerRect,
} from '../types'

/** height of the plug-lid lip that sits inside a lidded box's walls */
export const LIP_HEIGHT = 3
/** max extra material (per axis, total) added to a module to make it fill the box snugly */
export const MAX_SNUG_EXPANSION = 15
/** slack larger than this (mm) is reported as a rattle risk */
const SLACK_WARN = 2
/** never split piece stacks into cavities shallower than this (avoids silly fragmentation) */
export const MIN_SPLIT_DEPTH = 12
/** smallest layer height worth targeting when spreading modules across the floor */
const MIN_LAYER_HEIGHT = 25
const MAX_LAYER_CANDIDATES = 4
/** gaps at least this wide (mm) get a printed spacer box instead of thicker walls */
export const MIN_SPACER = 10

/** modules are user containers; spacers are auto-generated gap fillers */
export type ModuleType = ContainerType | 'spacer'

// ---------------------------------------------------------------------------
// Output model
// ---------------------------------------------------------------------------

export interface Compartment {
  componentId: string
  label: string
  /** offset of the cavity from the module's interior origin (inside the perimeter wall) */
  x: number
  y: number
  /** bounding box of the recess (the actual cut matches the piece shape) */
  length: number
  width: number
  /** cavity depth = stacked height of the pieces it holds */
  depth: number
  quantity: number
  shape: PieceShape
  /** measured shape size (no clearance): circle → diameter, polygons → their dimLabel dimension */
  shapeDim: number
  /** bounding box was rotated 90° during packing (shaped recess rotates with it) */
  rotated: boolean
}

/** bounding-box footprint (mm) of a single piece lying flat */
export function footprintOf(c: GameComponent): { l: number; w: number } {
  if (c.shape === 'circle') return { l: c.length, w: c.length }
  if (isPolygon(c.shape)) {
    const d = POLYGON_SHAPES[c.shape]
    return { l: c.length * d.bboxL, w: c.length * d.bboxW }
  }
  return { l: c.length, w: c.width }
}

/**
 * Bounding box of the recess for a piece, including clearance. For polygons
 * the clearance is a true outward offset (each edge moves out by `cc`), which
 * grows the bounding box by more than 2·cc for pointy shapes like triangles.
 */
export function cavityFootprint(c: GameComponent, cc: number): { l: number; w: number } {
  if (c.shape === 'circle') {
    const d = c.length + 2 * cc
    return { l: d, w: d }
  }
  if (isPolygon(c.shape)) {
    const d = POLYGON_SHAPES[c.shape]
    const R = c.length * d.radius
    const scale = R > 0 ? (R + cc / Math.cos(Math.PI / d.sides)) / R : 1
    return { l: c.length * d.bboxL * scale, w: c.length * d.bboxW * scale }
  }
  return { l: c.length + 2 * cc, w: c.width + 2 * cc }
}

export interface ModuleSpec {
  id: string
  groupId: string
  name: string
  type: ModuleType
  /** printed body dims (lid plate not included in height) */
  outer: { length: number; width: number; height: number }
  /** height the module occupies in the game box (body + lid plate for lidded boxes) */
  packedHeight: number
  /** interior depth from cavity top plane down (max compartment depth) */
  interiorDepth: number
  compartments: Compartment[]
  hasLid: boolean
  /** identical modules needed (e.g. one per player) */
  copies: number
  warnings: string[]
  /**
   * combined spacers only: the floor rectangles (relative to the module's
   * bounding-box corner) that print as one piece — the outline may be
   * L-shaped, so `outer` is just the bounding box
   */
  rects?: SpacerRect[]
}

export interface PlacedInstance {
  id: string
  moduleId: string
  /** min corner inside the game box */
  x: number
  y: number
  z: number
  /** rotated 90° in plan view (module length runs along box width) */
  rotated: boolean
  layer: number
  /** final footprint in BOX axes after snug expansion */
  length: number
  width: number
  height: number
}

export interface PrintVariant {
  key: string
  moduleId: string
  name: string
  /** how many of this exact part to print */
  count: number
  /** final printed body dims in MODULE axes */
  outer: { length: number; width: number; height: number }
  /** snug-fit material added on top of the spec dims (height: raised floor / taller walls) */
  extra: { length: number; width: number; height: number }
}

export interface PackResult {
  modules: ModuleSpec[]
  instances: PlacedInstance[]
  variants: PrintVariant[]
  layers: { z: number; height: number }[]
  usedHeight: number
  /** share of the box floor plan covered, averaged over layers (0..1) */
  floorCoverage: number
  fits: boolean
  warnings: string[]
  /** 'manual' when user-dragged positions are in effect */
  mode: 'auto' | 'manual'
  /** layer-count target the module sizing was computed with */
  targetLayers: number
}

// ---------------------------------------------------------------------------
// 2D shelf packing
// ---------------------------------------------------------------------------

export interface ShelfRect {
  id: string
  l: number
  w: number
  canRotate: boolean
}

export interface ShelfPlaced {
  id: string
  x: number
  y: number
  l: number
  w: number
  rotated: boolean
  shelf: number
}

export interface ShelfResult {
  placed: ShelfPlaced[]
  unplaced: string[]
  /** bounding size actually used */
  length: number
  width: number
  shelves: { y: number; w: number; usedL: number; items: ShelfPlaced[] }[]
}

/**
 * Greedy shelf packing into a binL × binW area. Items are sorted by their
 * (post-orientation) width, so shelves shrink monotonically. `gap` is left
 * between neighbouring items and between shelves (used for divider walls).
 */
export function shelfPack(
  rects: ShelfRect[],
  binL: number,
  binW: number,
  gap: number,
): ShelfResult {
  // orient longest side along X so shelves stay low
  const oriented = rects.map((r) => {
    if (r.canRotate && r.w > r.l && r.w <= binL) {
      return { ...r, l: r.w, w: r.l, rotated: true }
    }
    return { ...r, rotated: false }
  })
  oriented.sort((a, b) => b.w - a.w || b.l - a.l)

  const shelves: { y: number; w: number; usedL: number; items: ShelfPlaced[] }[] = []
  const placed: ShelfPlaced[] = []
  const unplaced: string[] = []
  let nextY = 0

  for (const r of oriented) {
    let done = false
    // try existing shelves first
    for (let si = 0; si < shelves.length && !done; si++) {
      const s = shelves[si]
      const startX = s.usedL === 0 ? 0 : s.usedL + gap
      // as-is
      if (r.w <= s.w && startX + r.l <= binL) {
        const p: ShelfPlaced = { id: r.id, x: startX, y: s.y, l: r.l, w: r.w, rotated: r.rotated, shelf: si }
        s.items.push(p)
        s.usedL = startX + r.l
        placed.push(p)
        done = true
      } else if (r.canRotate && r.l <= s.w && startX + r.w <= binL) {
        const p: ShelfPlaced = { id: r.id, x: startX, y: s.y, l: r.w, w: r.l, rotated: !r.rotated, shelf: si }
        s.items.push(p)
        s.usedL = startX + r.w
        placed.push(p)
        done = true
      }
    }
    if (done) continue

    // open a new shelf
    const shelfY = shelves.length === 0 ? 0 : nextY + gap
    if (r.l <= binL && shelfY + r.w <= binW) {
      const p: ShelfPlaced = { id: r.id, x: 0, y: shelfY, l: r.l, w: r.w, rotated: r.rotated, shelf: shelves.length }
      shelves.push({ y: shelfY, w: r.w, usedL: r.l, items: [p] })
      placed.push(p)
      nextY = shelfY + r.w
    } else if (r.canRotate && r.w <= binL && shelfY + r.l <= binW) {
      const p: ShelfPlaced = { id: r.id, x: 0, y: shelfY, l: r.w, w: r.l, rotated: !r.rotated, shelf: shelves.length }
      shelves.push({ y: shelfY, w: r.l, usedL: r.w, items: [p] })
      placed.push(p)
      nextY = shelfY + r.l
    } else {
      unplaced.push(r.id)
    }
  }

  const length = shelves.reduce((m, s) => Math.max(m, s.usedL), 0)
  return { placed, unplaced, length, width: nextY, shelves }
}

// ---------------------------------------------------------------------------
// Module computation
// ---------------------------------------------------------------------------

interface Stack {
  comp: GameComponent
  quantity: number
  depth: number
}

/** split a pile of pieces into stacks no taller than maxDepth */
function splitStacks(comp: GameComponent, maxDepth: number): Stack[] {
  const total = comp.thickness * comp.quantity
  if (total <= maxDepth) {
    return [{ comp, quantity: comp.quantity, depth: total }]
  }
  const perStack = Math.max(1, Math.floor(maxDepth / comp.thickness))
  const k = Math.ceil(comp.quantity / perStack)
  const stacks: Stack[] = []
  let remaining = comp.quantity
  for (let i = 0; i < k; i++) {
    const q = Math.min(perStack, remaining)
    remaining -= q
    stacks.push({ comp, quantity: q, depth: comp.thickness * q })
  }
  return stacks
}

/**
 * @param targetModuleHeight aim for modules no taller than this (defaults to
 * the full box height). Smaller targets split piece stacks into shorter, wider
 * modules that spread across the box floor instead of standing as tall towers.
 */
export function computeModules(
  project: Project,
  targetModuleHeight?: number,
): { modules: ModuleSpec[]; warnings: string[] } {
  const { box, printer: s, groups, components, playerCount } = project
  const targetH = Math.min(targetModuleHeight ?? box.height, box.height)
  /** deepest cavity allowed given the module's non-cavity overhead */
  const cavityCap = (overhead: number) =>
    Math.min(Math.max(1, box.height - overhead), Math.max(MIN_SPLIT_DEPTH, targetH - overhead))
  const modules: ModuleSpec[] = []
  const warnings: string[] = []

  for (const group of groups) {
    const comps = components.filter((c) => {
      if (c.groupId !== group.id || c.thickness <= 0 || c.quantity <= 0) return false
      const fp = footprintOf(c)
      return fp.l > 0 && fp.w > 0
    })
    if (comps.length === 0) continue
    const copies = group.perPlayer ? Math.max(1, playerCount) : 1

    if (group.containerType === 'stack-tray') {
      const maxDepth = cavityCap(s.floorThickness)
      let idx = 0
      for (const comp of comps) {
        const stacks = splitStacks(comp, maxDepth)
        for (const st of stacks) {
          idx++
          const cav = cavityFootprint(comp, s.componentClearance)
          const cavL = cav.l
          const cavW = cav.w
          const outer = {
            length: cavL + 2 * s.wallThickness,
            width: cavW + 2 * s.wallThickness,
            height: s.floorThickness + st.depth,
          }
          const mod: ModuleSpec = {
            id: `${group.id}:${comp.id}:${idx}`,
            groupId: group.id,
            name: stacks.length > 1 ? `${group.name} – ${comp.name} tray ${idx}` : `${group.name} – ${comp.name} tray`,
            type: 'stack-tray',
            outer,
            packedHeight: outer.height,
            interiorDepth: st.depth,
            compartments: [
              {
                componentId: comp.id,
                label: comp.name,
                x: 0,
                y: 0,
                length: cavL,
                width: cavW,
                depth: st.depth,
                quantity: st.quantity,
                shape: comp.shape ?? 'rect',
                shapeDim: comp.length,
                rotated: false,
              },
            ],
            hasLid: false,
            copies,
            warnings: [],
          }
          checkModuleSize(mod, project, warnings)
          modules.push(mod)
        }
      }
    } else if (group.containerType === 'well') {
      // pieces stand on edge: the stack pivots 90° so it runs horizontally and
      // piece edges face up. One well per component (split if the row is long).
      let idx = 0
      for (const comp of comps) {
        const fp = footprintOf(comp)
        const availV = box.height - s.floorThickness
        const hi = Math.max(fp.l, fp.w)
        const lo = Math.min(fp.l, fp.w)
        // stand pieces as tall as the box allows (smaller footprint)
        const vertical = hi <= availV ? hi : lo
        const horiz = vertical === hi ? lo : hi
        const maxRow = Math.max(box.length, box.width) - 2 * s.wallThickness - 2 * s.componentClearance
        const stacks = splitStacks(comp, Math.max(1, maxRow))
        for (const st of stacks) {
          idx++
          const cavL = st.depth + 2 * s.componentClearance // row of pieces on edge
          const cavW = horiz + 2 * s.componentClearance
          const outer = {
            length: cavL + 2 * s.wallThickness,
            width: cavW + 2 * s.wallThickness,
            height: s.floorThickness + vertical,
          }
          const mod: ModuleSpec = {
            id: `${group.id}:${comp.id}:${idx}`,
            groupId: group.id,
            name: stacks.length > 1 ? `${group.name} – ${comp.name} well ${idx}` : `${group.name} – ${comp.name} well`,
            type: 'well',
            outer,
            packedHeight: outer.height,
            interiorDepth: vertical,
            compartments: [
              {
                componentId: comp.id,
                label: comp.name,
                x: 0,
                y: 0,
                length: cavL,
                width: cavW,
                depth: vertical,
                quantity: st.quantity,
                shape: 'rect', // on-edge pieces always get a rectangular slot
                shapeDim: 0,
                rotated: false,
              },
            ],
            hasLid: false,
            copies,
            warnings: [],
          }
          checkModuleSize(mod, project, warnings)
          modules.push(mod)
        }
      }
    } else {
      // lidded box: one module per group, one compartment per stack
      const plateT = s.floorThickness
      const maxDepth = cavityCap(s.floorThickness + LIP_HEIGHT + plateT)
      const stacks = comps.flatMap((c) => splitStacks(c, maxDepth))
      const rects: ShelfRect[] = stacks.map((st, i) => {
        const cav = cavityFootprint(st.comp, s.componentClearance)
        return { id: String(i), l: cav.l, w: cav.w, canRotate: true }
      })
      const binL = Math.max(1, box.length - 2 * s.wallThickness)
      const binW = Math.max(1, box.width - 2 * s.wallThickness)
      const res = shelfPack(rects, binL, binW, s.wallThickness)

      const compartments: Compartment[] = res.placed.map((p) => {
        const st = stacks[Number(p.id)]
        return {
          componentId: st.comp.id,
          label: st.comp.name,
          x: p.x,
          y: p.y,
          length: p.l,
          width: p.w,
          depth: st.depth,
          quantity: st.quantity,
          shape: st.comp.shape ?? 'rect',
          shapeDim: st.comp.length,
          rotated: p.rotated,
        }
      })
      const depth = compartments.reduce((m, c) => Math.max(m, c.depth), 0)
      const bodyH = s.floorThickness + depth + LIP_HEIGHT
      const outer = {
        length: res.length + 2 * s.wallThickness,
        width: res.width + 2 * s.wallThickness,
        height: bodyH,
      }
      const mod: ModuleSpec = {
        id: group.id,
        groupId: group.id,
        name: group.perPlayer ? `${group.name} (per player)` : group.name,
        type: 'lidded-box',
        outer,
        packedHeight: bodyH + plateT,
        interiorDepth: depth,
        compartments,
        hasLid: true,
        copies,
        warnings: [],
      }
      if (res.unplaced.length > 0) {
        mod.warnings.push(
          `${res.unplaced.length} component stack(s) do not fit in a single box footprint — split this group or check dimensions`,
        )
      }
      checkModuleSize(mod, project, warnings)
      modules.push(mod)
    }
  }

  for (const m of modules) warnings.push(...m.warnings.map((w) => `${m.name}: ${w}`))
  return { modules, warnings }
}

function checkModuleSize(mod: ModuleSpec, project: Project, _warnings: string[]) {
  const { box, printer: s } = project
  const { length, width } = mod.outer
  const fitsFootprint =
    (length <= box.length && width <= box.width) || (width <= box.length && length <= box.width)
  if (!fitsFootprint) mod.warnings.push('footprint is larger than the game box interior')
  if (mod.packedHeight > box.height) mod.warnings.push('taller than the game box interior')
  const fitsBed =
    (length <= s.bedLength && width <= s.bedWidth) || (width <= s.bedLength && length <= s.bedWidth)
  if (!fitsBed) mod.warnings.push('larger than the printer bed')
  if (mod.outer.height > s.bedHeight) mod.warnings.push('taller than the printer build volume')
}

// ---------------------------------------------------------------------------
// Spacers
// ---------------------------------------------------------------------------

/**
 * Build a spacer for a floor gap, split into an even grid of identical
 * sections that each fit the print bed.
 */
function createSpacer(
  index: number,
  l: number,
  w: number,
  x: number,
  y: number,
  h: number,
  layer: number,
  z: number,
  printer: PrinterSettings,
): { module: ModuleSpec; instances: PlacedInstance[]; warning?: string } {
  const { bedLength, bedWidth, bedHeight } = printer
  const bedMax = Math.max(bedLength, bedWidth)
  const bedMin = Math.min(bedLength, bedWidth)
  const fitsBed = (a: number, b: number) => Math.max(a, b) <= bedMax && Math.min(a, b) <= bedMin
  let nX = 1
  let nY = 1
  while (!fitsBed(l / nX, w / nY) && nX * nY < 64) {
    if (l / nX >= w / nY) nX++
    else nY++
  }
  const sections = nX * nY
  const segL = l / nX
  const segW = w / nY
  const id = `spacer:${index}`
  const module: ModuleSpec = {
    id,
    groupId: '',
    name: sections > 1 ? `Spacer ${index} (${sections} sections)` : `Spacer ${index}`,
    type: 'spacer',
    outer: { length: segL, width: segW, height: h },
    packedHeight: h,
    interiorDepth: 0,
    compartments: [],
    hasLid: false,
    copies: sections,
    warnings: [],
  }
  const instances: PlacedInstance[] = []
  for (let i = 0; i < nX; i++) {
    for (let j = 0; j < nY; j++) {
      instances.push({
        id: `${id}#${i * nY + j}`,
        moduleId: id,
        x: x + i * segL,
        y: y + j * segW,
        z,
        rotated: false,
        layer,
        length: segL,
        width: segW,
        height: h,
      })
    }
  }
  return {
    module,
    instances,
    warning: h > bedHeight ? `Spacer ${index} is taller than the printer build volume` : undefined,
  }
}

/** axis-aligned free-space bookkeeping for gap filling */
export type FreeRect = SpacerRect

export const rectsOverlap = (a: SpacerRect, b: SpacerRect) =>
  a.x < b.x + b.l - 0.01 && b.x < a.x + a.l - 0.01 && a.y < b.y + b.w - 0.01 && b.y < a.y + a.w - 0.01

/** remove `r` from every rect in `free`, splitting into up to 4 pieces each */
export function subtractRect(free: FreeRect[], r: FreeRect): FreeRect[] {
  const out: FreeRect[] = []
  for (const f of free) {
    const ix1 = Math.max(f.x, r.x)
    const iy1 = Math.max(f.y, r.y)
    const ix2 = Math.min(f.x + f.l, r.x + r.l)
    const iy2 = Math.min(f.y + f.w, r.y + r.w)
    if (ix1 >= ix2 - 0.01 || iy1 >= iy2 - 0.01) {
      out.push(f)
      continue
    }
    if (ix1 - f.x > 0.5) out.push({ x: f.x, y: f.y, l: ix1 - f.x, w: f.w })
    if (f.x + f.l - ix2 > 0.5) out.push({ x: ix2, y: f.y, l: f.x + f.l - ix2, w: f.w })
    if (iy1 - f.y > 0.5) out.push({ x: ix1, y: f.y, l: ix2 - ix1, w: iy1 - f.y })
    if (f.y + f.w - iy2 > 0.5) out.push({ x: ix1, y: iy2, l: ix2 - ix1, w: f.y + f.w - iy2 })
  }
  return out
}

interface SpacerFillCtx {
  box: Project['box']
  printer: PrinterSettings
  merges: SpacerMerge[]
  usedMergeIds: Set<string>
  state: { count: number }
  spacerModules: ModuleSpec[]
  instances: PlacedInstance[]
  warnings: string[]
}

/**
 * Fill the free floor of one layer with spacers: user-combined merges are
 * honoured first (if their area is still free), then the remaining free
 * rectangles get auto spacers (bed-split). Shared by auto and manual packing.
 */
function fillLayerSpacers(
  ctx: SpacerFillCtx,
  layerIdx: number,
  z: number,
  height: number,
  content: SpacerRect[],
) {
  const { box, printer } = ctx
  let free: FreeRect[] = [{ x: 0, y: 0, l: box.length, w: box.width }]
  for (const r of content) free = subtractRect(free, r)

  const claimed: SpacerRect[] = []
  for (const merge of ctx.merges) {
    if (ctx.usedMergeIds.has(merge.id) || Math.abs(merge.z - z) > 0.5) continue
    const ok = merge.rects.every(
      (r) =>
        r.x >= -0.01 &&
        r.y >= -0.01 &&
        r.x + r.l <= box.length + 0.01 &&
        r.y + r.w <= box.width + 0.01 &&
        !content.some((c) => rectsOverlap(r, c)) &&
        !claimed.some((c) => rectsOverlap(r, c)),
    )
    if (!ok) continue // layout changed under the merge: silently fall back to auto spacers
    ctx.usedMergeIds.add(merge.id)
    claimed.push(...merge.rects)
    for (const r of merge.rects) free = subtractRect(free, r)

    const minX = Math.min(...merge.rects.map((r) => r.x))
    const minY = Math.min(...merge.rects.map((r) => r.y))
    const L = Math.max(...merge.rects.map((r) => r.x + r.l)) - minX
    const W = Math.max(...merge.rects.map((r) => r.y + r.w)) - minY
    ctx.spacerModules.push({
      id: merge.id,
      groupId: '',
      name: `Combined spacer (${merge.rects.length} pieces)`,
      type: 'spacer',
      outer: { length: L, width: W, height },
      packedHeight: height,
      interiorDepth: 0,
      compartments: [],
      hasLid: false,
      copies: 1,
      warnings: [],
      rects: merge.rects.map((r) => ({ ...r, x: r.x - minX, y: r.y - minY })),
    })
    ctx.instances.push({
      id: `${merge.id}#0`,
      moduleId: merge.id,
      x: minX,
      y: minY,
      z,
      rotated: false,
      layer: layerIdx,
      length: L,
      width: W,
      height,
    })
    const { bedLength, bedWidth } = printer
    const fitsBed =
      (L <= bedLength && W <= bedWidth) || (W <= bedLength && L <= bedWidth)
    if (!fitsBed) {
      ctx.warnings.push(
        `Combined spacer (${L.toFixed(0)} × ${W.toFixed(0)} mm) is larger than your ${bedLength} × ${bedWidth} mm print bed — split it or check your printer settings`,
      )
    }
  }

  for (const f of free) {
    if (f.l < MIN_SPACER || f.w < MIN_SPACER) continue
    ctx.state.count++
    const out = createSpacer(ctx.state.count, f.l, f.w, f.x, f.y, height, layerIdx, z, printer)
    ctx.spacerModules.push(out.module)
    ctx.instances.push(...out.instances)
    if (out.warning) ctx.warnings.push(out.warning)
  }
}

// ---------------------------------------------------------------------------
// Layout: place module instances into the game box, layer by layer
// ---------------------------------------------------------------------------

export function packLayout(modules: ModuleSpec[], project: Project): PackResult {
  const { box } = project
  const warnings: string[] = []

  interface Item {
    key: string
    moduleId: string
    l: number
    w: number
    h: number
  }
  const items: Item[] = []
  for (const m of modules) {
    for (let i = 0; i < m.copies; i++) {
      items.push({
        key: `${m.id}#${i}`,
        moduleId: m.id,
        l: m.outer.length,
        w: m.outer.width,
        h: m.packedHeight,
      })
    }
  }
  items.sort((a, b) => b.h - a.h || b.l * b.w - a.l * a.w)

  const instances: PlacedInstance[] = []
  const layers: { z: number; height: number }[] = []
  const spacerModules: ModuleSpec[] = []
  const spacersOn = project.printer.generateSpacers ?? false
  const syncOn = project.printer.syncModuleHeights ?? false
  let contentArea = 0
  let remaining = items
  let z = 0
  let layerIdx = 0
  let allPlaced = true

  while (remaining.length > 0) {
    const res = shelfPack(
      remaining.map((it) => ({ id: it.key, l: it.l, w: it.w, canRotate: true })),
      box.length,
      box.width,
      0,
    )
    if (res.placed.length === 0) {
      allPlaced = false
      warnings.push(
        `${remaining.length} module(s) have a footprint larger than the game box and could not be placed`,
      )
      break
    }
    const byKey = new Map(remaining.map((it) => [it.key, it]))
    const layerHeight = res.placed.reduce((m, p) => Math.max(m, byKey.get(p.id)!.h), 0)

    // Snug fit: small gaps are absorbed by thicker walls (expansion); gaps of
    // MIN_SPACER or more get a printed spacer box instead (when enabled).
    const nShelves = res.shelves.length
    const slackY = box.width - res.width
    const ySpacer = spacersOn && slackY >= MIN_SPACER
    const perShelfY = ySpacer ? 0 : Math.min(slackY / nShelves, MAX_SNUG_EXPANSION)
    let residual = ySpacer ? 0 : Math.max(0, slackY - perShelfY * nShelves)
    let yCursor = 0
    for (const shelf of res.shelves) {
      const n = shelf.items.length
      const slackX = box.length - shelf.usedL
      const xSpacer = spacersOn && slackX >= MIN_SPACER
      const perItemX = xSpacer ? 0 : Math.min(slackX / n, MAX_SNUG_EXPANSION)
      if (!xSpacer) residual = Math.max(residual, slackX - perItemX * n)
      const shelfH = shelf.w + perShelfY
      let xCursor = 0
      for (const p of shelf.items) {
        const item = byKey.get(p.id)!
        const fl = p.l + perItemX
        let fw = Math.min(shelfH, p.w + MAX_SNUG_EXPANSION)
        // item much narrower than its shelf: leave the strip for spacer fill
        if (spacersOn && shelfH - p.w >= MIN_SPACER) {
          fw = p.w
        } else {
          residual = Math.max(residual, shelfH - fw)
        }
        instances.push({
          id: p.id,
          moduleId: item.moduleId,
          x: xCursor,
          y: yCursor,
          z,
          rotated: p.rotated,
          layer: layerIdx,
          length: fl,
          width: fw,
          // sync: shorter modules are printed taller so the layer is a flat deck
          height: syncOn ? layerHeight : item.h,
        })
        contentArea += fl * fw
        xCursor += fl
      }
      yCursor += shelfH
    }
    if (residual > SLACK_WARN) {
      warnings.push(
        `layer ${layerIdx + 1}: up to ${residual.toFixed(1)} mm of horizontal slack remains — consider a spacer or rearranging groups`,
      )
    }

    layers.push({ z, height: layerHeight })
    z += layerHeight
    layerIdx++
    remaining = remaining.filter((it) => res.unplaced.includes(it.key))
  }

  if (spacersOn) {
    const ctx: SpacerFillCtx = {
      box,
      printer: project.printer,
      merges: project.spacerMerges ?? [],
      usedMergeIds: new Set(),
      state: { count: 0 },
      spacerModules,
      instances,
      warnings,
    }
    layers.forEach((layer, li) => {
      const content = instances
        .filter((i) => i.layer === li && !i.moduleId.startsWith('spacer:') && !i.moduleId.startsWith('merge:'))
        .map((i) => ({ x: i.x, y: i.y, l: i.length, w: i.width }))
      fillLayerSpacers(ctx, li, layer.z, layer.height, content)
    })
  }

  const usedHeight = z
  const fits = allPlaced && usedHeight <= box.height + 0.001
  if (usedHeight > box.height + 0.001) {
    warnings.push(
      `modules stack ${usedHeight.toFixed(1)} mm high but the box interior is only ${box.height} mm`,
    )
  } else if (allPlaced && instances.length > 0) {
    const topSlack = box.height - usedHeight
    if (topSlack > SLACK_WARN) {
      warnings.push(
        `${topSlack.toFixed(1)} mm of vertical space remains under the lid — boards/rulebooks on top can fill it, or add a spacer layer`,
      )
    }
  }

  const allModules = [...modules, ...spacerModules]
  const variants = buildVariants(allModules, instances)
  const boxArea = box.length * box.width
  // coverage counts real content only — spacers fill gaps, they aren't storage
  const floorCoverage =
    layers.length > 0 && boxArea > 0 ? contentArea / (layers.length * boxArea) : 0
  return {
    modules: allModules,
    instances,
    variants,
    layers,
    usedHeight,
    floorCoverage,
    fits,
    warnings,
    mode: 'auto',
    targetLayers: 1,
  }
}

function buildVariants(modules: ModuleSpec[], instances: PlacedInstance[]): PrintVariant[] {
  const byModule = new Map(modules.map((m) => [m.id, m]))
  const map = new Map<string, PrintVariant>()
  for (const inst of instances) {
    const mod = byModule.get(inst.moduleId)!
    // map footprint back into module axes
    const L = inst.rotated ? inst.width : inst.length
    const W = inst.rotated ? inst.length : inst.width
    const rL = Math.round(L * 10) / 10
    const rW = Math.round(W * 10) / 10
    // height sync raises the printed body by the same amount the packed
    // height grew (lid plate thickness is unaffected)
    const extraH = Math.max(0, inst.height - mod.packedHeight)
    const rH = Math.round((mod.outer.height + extraH) * 10) / 10
    const key = `${mod.id}|${rL}x${rW}x${rH}`
    const existing = map.get(key)
    if (existing) {
      existing.count++
    } else {
      map.set(key, {
        key,
        moduleId: mod.id,
        name: mod.name,
        count: 1,
        outer: { length: rL, width: rW, height: rH },
        extra: {
          length: Math.max(0, rL - mod.outer.length),
          width: Math.max(0, rW - mod.outer.width),
          height: Math.round(extraH * 10) / 10,
        },
      })
    }
  }
  // disambiguate names when one module produced differently-sized variants
  const byName = new Map<string, PrintVariant[]>()
  for (const v of map.values()) {
    const list = byName.get(v.moduleId) ?? []
    list.push(v)
    byName.set(v.moduleId, list)
  }
  for (const list of byName.values()) {
    if (list.length > 1) {
      list.forEach((v, i) => {
        v.name = `${v.name} (${String.fromCharCode(65 + i)})`
      })
    }
  }
  return [...map.values()]
}

// ---------------------------------------------------------------------------
// Manual layout: user-dragged positions
// ---------------------------------------------------------------------------

const xyOverlap = (a: PlacedInstance, b: PlacedInstance) =>
  a.x < b.x + b.length - 0.01 &&
  b.x < a.x + a.length - 0.01 &&
  a.y < b.y + b.width - 0.01 &&
  b.y < a.y + a.width - 0.01

const zOverlap = (a: PlacedInstance, b: PlacedInstance) =>
  a.z < b.z + b.height - 0.01 && b.z < a.z + a.height - 0.01

/**
 * Place modules at user-dragged positions. No snug expansion — the user is in
 * control; spacers (if enabled) fill the free floor space around the
 * arrangement. Overlaps and out-of-box footprints fail the fit; rising above
 * the box height only warns (the user may accept a bulging lid).
 */
export function packManual(modules: ModuleSpec[], project: Project): PackResult {
  const { box, printer } = project
  const positions = project.manualLayout?.positions ?? {}
  const warnings: string[] = []
  const syncOn = printer.syncModuleHeights ?? false
  const spacersOn = printer.generateSpacers ?? false

  const instances: PlacedInstance[] = []
  const pending: { id: string; m: ModuleSpec }[] = []
  for (const m of modules) {
    for (let i = 0; i < m.copies; i++) {
      const id = `${m.id}#${i}`
      const p = positions[id]
      if (p) {
        instances.push({
          id,
          moduleId: m.id,
          x: p.x,
          y: p.y,
          z: p.z,
          rotated: p.rotated,
          layer: 0,
          length: p.rotated ? m.outer.width : m.outer.length,
          width: p.rotated ? m.outer.length : m.outer.width,
          height: m.packedHeight,
        })
      } else {
        pending.push({ id, m })
      }
    }
  }

  // modules added after the arrangement was made: first free spot on the floor
  for (const { id, m } of pending) {
    const cand: PlacedInstance = {
      id,
      moduleId: m.id,
      x: 0,
      y: 0,
      z: 0,
      rotated: false,
      layer: 0,
      length: m.outer.length,
      width: m.outer.width,
      height: m.packedHeight,
    }
    let placed = false
    outer: for (let y = 0; y + cand.width <= box.width + 0.01 && !placed; y += 5) {
      for (let x = 0; x + cand.length <= box.length + 0.01; x += 5) {
        cand.x = x
        cand.y = y
        if (!instances.some((o) => xyOverlap(cand, o) && zOverlap(cand, o))) {
          placed = true
          break outer
        }
      }
    }
    if (!placed) {
      cand.x = 0
      cand.y = 0
      warnings.push(`${m.name}: no free floor space — placed at the corner, drag it somewhere`)
    }
    instances.push({ ...cand })
  }

  // group instances into layers by their z (kept from the auto snapshot)
  const zKeys = [...new Set(instances.map((i) => Math.round(i.z * 10) / 10))].sort((a, b) => a - b)
  const layers: { z: number; height: number }[] = []
  zKeys.forEach((zv, li) => {
    const members = instances.filter((i) => Math.round(i.z * 10) / 10 === zv)
    const height = members.reduce((mx, i) => Math.max(mx, i.height), 0)
    for (const i of members) {
      i.layer = li
      if (syncOn) i.height = height
    }
    layers.push({ z: zv, height })
  })

  // overlaps and bounds: prevented while dragging, but sizes can change after
  // an arrangement was made (edited components, pivoted containers)
  let overlaps = 0
  for (let i = 0; i < instances.length; i++) {
    for (let j = i + 1; j < instances.length; j++) {
      if (xyOverlap(instances[i], instances[j]) && zOverlap(instances[i], instances[j])) overlaps++
    }
  }
  if (overlaps > 0) {
    warnings.push(`${overlaps} pair(s) of modules overlap — drag them apart`)
  }
  const outOfBounds = instances.filter(
    (i) => i.x < -0.01 || i.y < -0.01 || i.x + i.length > box.length + 0.01 || i.y + i.width > box.width + 0.01,
  )
  if (outOfBounds.length > 0) {
    warnings.push(`${outOfBounds.length} module(s) extend past the box footprint`)
  }

  const usedHeight = instances.reduce((mx, i) => Math.max(mx, i.z + i.height), 0)
  if (usedHeight > box.height + 0.001) {
    warnings.push(
      `modules rise ${(usedHeight - box.height).toFixed(1)} mm above the box interior — the lid may not close`,
    )
  }

  // fill the free floor space of each layer with spacers (honouring merges)
  const spacerModules: ModuleSpec[] = []
  let contentArea = 0
  const ctx: SpacerFillCtx = {
    box,
    printer,
    merges: project.spacerMerges ?? [],
    usedMergeIds: new Set(),
    state: { count: 0 },
    spacerModules,
    instances,
    warnings,
  }
  layers.forEach((layer, li) => {
    const members = instances.filter(
      (i) => i.layer === li && !i.moduleId.startsWith('spacer:') && !i.moduleId.startsWith('merge:'),
    )
    const content = members.map((m) => ({ x: m.x, y: m.y, l: m.length, w: m.width }))
    for (const m of members) contentArea += m.length * m.width
    if (!spacersOn) return
    fillLayerSpacers(ctx, li, layer.z, layer.height, content)
  })

  const boxArea = box.length * box.width
  const allModules = [...modules, ...spacerModules]
  return {
    modules: allModules,
    instances,
    variants: buildVariants(allModules, instances),
    layers,
    usedHeight,
    floorCoverage: layers.length > 0 && boxArea > 0 ? contentArea / (layers.length * boxArea) : 0,
    fits: overlaps === 0 && outOfBounds.length === 0,
    warnings,
    mode: 'manual',
    targetLayers: project.manualLayout?.targetLayers ?? 1,
  }
}

/**
 * Full pipeline: project → modules → layout. Pure; safe to call in useMemo.
 *
 * Tries several target module heights (full box height, 1/2, 1/3, …) and keeps
 * the layout that best fills the box's length × width. Splitting stacks into
 * shorter, wider modules trades tall towers for floor coverage — modules "lie
 * down" across the floor first, and only stack when the floor plan is full.
 */
export function computeLayout(project: Project): PackResult {
  const { box } = project

  if (project.manualLayout) {
    const n = Math.max(1, project.manualLayout.targetLayers)
    const { modules, warnings } = computeModules(project, box.height / n)
    const result = packManual(modules, project)
    result.warnings = [...warnings, ...result.warnings]
    return result
  }

  const maxLayers = Math.max(
    1,
    Math.min(MAX_LAYER_CANDIDATES, Math.floor(box.height / MIN_LAYER_HEIGHT)),
  )
  let best: PackResult | null = null
  let bestScore = -Infinity
  for (let n = maxLayers; n >= 1; n--) {
    const { modules, warnings } = computeModules(project, box.height / n)
    const result = packLayout(modules, project)
    result.warnings = [...warnings, ...result.warnings]
    result.targetLayers = n
    // fitting dominates; then floor coverage (in %); light penalties keep the
    // packer from fragmenting into many modules or wasting height for no gain
    const score =
      (result.fits ? 1000 : 0) +
      result.floorCoverage * 100 -
      result.instances.length * 0.5 -
      result.usedHeight * 0.01
    if (score > bestScore) {
      bestScore = score
      best = result
    }
  }
  return best!
}
