/**
 * All dimensions are millimetres.
 * Axes: X = length, Y = width, Z = height (vertical, out of the game box).
 */

/**
 * - lidded-box: compartments accessed from the top, friction-fit lid
 * - stack-tray: open tray, pieces lie flat in a stack
 * - well: open container, pieces stand ON EDGE — the stack pivots 90° so the
 *   piece edges face up (flip through cards) instead of the top piece's back
 */
export type ContainerType = 'lidded-box' | 'stack-tray' | 'well'

/**
 * Piece footprint shape. Containers stay rectangular on the outside, but the
 * cavity is cut to match the shape so pieces rest securely in a recess.
 */
export type PolygonShape = 'triangle' | 'pentagon' | 'hex' | 'heptagon' | 'octagon'
export type PieceShape = 'rect' | 'circle' | 'card' | PolygonShape

/** bounding-box length of a hexagon = across-flats × 2/√3 */
export const HEX_RATIO = 2 / Math.sqrt(3)

export interface PolygonDef {
  sides: number
  /** rotation (deg) so the polygon sits flat-side-down in its bounding box */
  rotation: number
  /** circumradius per unit of the measured dimension */
  radius: number
  /** bounding box per unit of the measured dimension */
  bboxL: number
  bboxW: number
  /** what the user measures with calipers */
  dimLabel: string
}

/**
 * Regular polygons, each defined by the dimension a gamer would measure on a
 * physical piece. Geometry cuts them as n-sided prisms.
 */
export const POLYGON_SHAPES: Record<PolygonShape, PolygonDef> = {
  triangle: { sides: 3, rotation: 90, radius: 0.5773503, bboxL: 1, bboxW: 0.8660254, dimLabel: 'Side length' },
  pentagon: { sides: 5, rotation: 90, radius: 0.5257311, bboxL: 1, bboxW: 0.9510565, dimLabel: 'Width' },
  hex: { sides: 6, rotation: 0, radius: 0.5773503, bboxL: HEX_RATIO, bboxW: 1, dimLabel: 'Across flats' },
  heptagon: { sides: 7, rotation: 90, radius: 0.5128601, bboxL: 1, bboxW: 0.9749279, dimLabel: 'Width' },
  octagon: { sides: 8, rotation: 22.5, radius: 0.5411961, bboxL: 1, bboxW: 1, dimLabel: 'Across flats' },
}

export const isPolygon = (s: PieceShape | undefined): s is PolygonShape =>
  s !== undefined && s in POLYGON_SHAPES

export interface CardSize {
  id: string
  name: string
  length: number
  width: number
}

/** Common board game card sizes (mm). */
export const CARD_SIZES: CardSize[] = [
  { id: 'mini-american', name: 'Mini American', length: 41, width: 63 },
  { id: 'mini-euro', name: 'Mini Euro', length: 44, width: 68 },
  { id: 'standard-american', name: 'Standard American', length: 56, width: 87 },
  { id: 'standard-euro', name: 'Standard Euro', length: 59, width: 92 },
  { id: 'poker', name: 'Poker / Standard', length: 63.5, width: 88.9 },
  { id: 'bridge', name: 'Bridge', length: 57, width: 89 },
  { id: 'seven-wonders', name: '7 Wonders', length: 65, width: 100 },
  { id: 'square-70', name: 'Square (70 mm)', length: 70, width: 70 },
  { id: 'tarot', name: 'Tarot', length: 70, width: 120 },
  { id: 'dixit', name: 'Dixit / Large', length: 79, width: 120 },
]

export interface GameComponent {
  id: string
  name: string
  shape: PieceShape
  /** preset id from CARD_SIZES, or 'custom' — only meaningful when shape is 'card' */
  cardSizeId?: string
  /**
   * Size of a single piece lying flat:
   * rect/card → length × width; circle → length = diameter;
   * hex → length = width across flats (width is ignored).
   */
  length: number
  width: number
  /** height of a single piece lying flat (stack step) */
  thickness: number
  /**
   * Number of pieces stored together. For a per-player group this is the
   * count for ONE player (each player gets an identical module).
   */
  quantity: number
  groupId: string
}

export interface ComponentGroup {
  id: string
  name: string
  containerType: ContainerType
  /** one identical module printed per player */
  perPlayer: boolean
  /** preview colour */
  color: string
  /**
   * keep compartments exactly as the entered length × width (no 90° auto-
   * rotation while packing) — e.g. three 30×60 pieces side by side make a
   * ~90×60 box instead of a 180×30 row
   */
  fixedOrientation?: boolean
}

export interface PrinterSettings {
  bedLength: number
  bedWidth: number
  bedHeight: number
  /** perimeter and divider wall thickness */
  wallThickness: number
  floorThickness: number
  /** per-side gap between a lid lip and the walls it slides into */
  lidClearance: number
  /** per-side gap added around components inside a cavity */
  componentClearance: number
  /** print hollow spacer boxes to fill leftover floor gaps so modules can't slide */
  generateSpacers: boolean
  /** lower ALL spacers below their layer height by this many mm (finger room to lift modules out) */
  spacerHeightOffset: number
  /** snap container footprints to the 42 mm Gridfinity grid and add base feet */
  gridfinityBase: boolean
  /**
   * raise shorter modules so everything in a layer is the same height (flat
   * deck): trays/wells get a thicker floor (contents stay flush with the top),
   * lidded boxes get taller walls
   */
  syncModuleHeights: boolean
}

export interface BoxDims {
  /** interior dimensions of the game box */
  length: number
  width: number
  height: number
}

export interface PrinterPreset {
  id: string
  name: string
  bedLength: number
  bedWidth: number
  bedHeight: number
}

/** common print volumes; "custom" in the UI keeps whatever is typed */
export const PRINTER_PRESETS: PrinterPreset[] = [
  { id: 'bambu-a1-mini', name: 'Bambu Lab A1 mini', bedLength: 180, bedWidth: 180, bedHeight: 180 },
  { id: 'bambu-256', name: 'Bambu Lab A1 / P1 / X1', bedLength: 256, bedWidth: 256, bedHeight: 256 },
  { id: 'prusa-mini', name: 'Prusa MINI+', bedLength: 180, bedWidth: 180, bedHeight: 180 },
  { id: 'prusa-mk4', name: 'Prusa MK3S / MK4', bedLength: 250, bedWidth: 210, bedHeight: 220 },
  { id: 'prusa-xl', name: 'Prusa XL', bedLength: 360, bedWidth: 360, bedHeight: 360 },
  { id: 'anycubic-kobra-3', name: 'Anycubic Kobra 3 / v2', bedLength: 255, bedWidth: 255, bedHeight: 260 },
  { id: 'ender-3', name: 'Creality Ender 3 / V2 / V3', bedLength: 220, bedWidth: 220, bedHeight: 250 },
  { id: 'k1-max', name: 'Creality K1 Max', bedLength: 300, bedWidth: 300, bedHeight: 300 },
  { id: 'neptune-4', name: 'Elegoo Neptune 4', bedLength: 225, bedWidth: 225, bedHeight: 265 },
  { id: 'voron-350', name: 'Voron 2.4 350', bedLength: 350, bedWidth: 350, bedHeight: 340 },
]

/** user-dragged position of one module instance (mm, box coordinates) */
export interface ManualPlacement {
  x: number
  y: number
  z: number
  rotated: boolean
}

/** axis-aligned rectangle on the box floor (mm) */
export interface SpacerRect {
  x: number
  y: number
  l: number
  w: number
}

/**
 * User-combined spacers: the listed floor rectangles print as ONE piece.
 * Validated against the live layout at pack time; silently dropped if the
 * area is no longer free.
 */
export interface SpacerMerge {
  id: string
  z: number
  rects: SpacerRect[]
  /** hollow the combined outline as one open shell instead of per-rectangle (no walls at the seams) */
  removeInnerWalls?: boolean
}

export interface Project {
  name: string
  playerCount: number
  box: BoxDims
  components: GameComponent[]
  groups: ComponentGroup[]
  printer: PrinterSettings
  /**
   * present once the user has dragged modules around: positions override the
   * auto-packer. targetLayers pins the module sizing the arrangement was
   * built with so modules don't resize under the user.
   */
  manualLayout?: {
    targetLayers: number
    positions: Record<string, ManualPlacement>
  }
  /** user-combined spacers (survive re-layouts only while their area stays free) */
  spacerMerges?: SpacerMerge[]
  /**
   * per-module printed-size overrides (mm), keyed by module id. Grow-only:
   * values below the computed minimum are ignored. Lets users match the
   * sizes of similar modules so they align in the box. `height` targets the
   * PACKED height (incl. lid plate for lidded boxes) so container types match 1:1.
   */
  moduleSizes?: Record<string, ModuleSizeOverride>
  /**
   * per-spacer height lowering (mm below layer height), overriding the global
   * printer.spacerHeightOffset. Keyed by merge id for combined spacers, or a
   * positional key for auto spacers (dropped silently when the layout moves).
   */
  spacerHeightOffsets?: Record<string, number>
}

export interface ModuleSizeOverride {
  length?: number
  width?: number
  height?: number
}

export const DEFAULT_PRINTER: PrinterSettings = {
  bedLength: 220,
  bedWidth: 220,
  bedHeight: 250,
  wallThickness: 1.6,
  floorThickness: 1.2,
  lidClearance: 0.15,
  componentClearance: 0.4,
  generateSpacers: true,
  syncModuleHeights: false, // opt-in via the "Sync heights" button in the preview
  spacerHeightOffset: 0,
  gridfinityBase: false,
}
