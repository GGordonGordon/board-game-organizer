import init from 'manifold-3d'
import { POLYGON_SHAPES, isPolygon, type PrinterSettings } from '../types'
import { LIP_HEIGHT, type Compartment, type ModuleSpec, type PrintVariant } from './packing'

type ManifoldModule = Awaited<ReturnType<typeof init>>
type ManifoldStatic = ManifoldModule['Manifold']
type Solid = InstanceType<ManifoldStatic>

let modPromise: Promise<ManifoldModule> | null = null
export function getManifold(): Promise<ManifoldModule> {
  if (!modPromise) {
    modPromise = init().then((m) => {
      m.setup()
      return m
    })
  }
  return modPromise
}

export interface MeshData {
  positions: Float32Array
  indices: Uint32Array
}

export interface PrintPart {
  /** file name without extension */
  name: string
  mesh: MeshData
}

function toMeshData(solid: Solid): MeshData {
  const mesh = solid.getMesh()
  const np = mesh.numProp
  let positions: Float32Array
  if (np === 3) {
    positions = mesh.vertProperties.slice()
  } else {
    const nVerts = mesh.vertProperties.length / np
    positions = new Float32Array(nVerts * 3)
    for (let i = 0; i < nVerts; i++) {
      positions[i * 3] = mesh.vertProperties[i * np]
      positions[i * 3 + 1] = mesh.vertProperties[i * np + 1]
      positions[i * 3 + 2] = mesh.vertProperties[i * np + 2]
    }
  }
  return { positions, indices: mesh.triVerts.slice() }
}

/**
 * Cavity solid matching the piece shape, with its bounding-box corner at the
 * origin so callers can translate it like a plain cube. Rectangular pieces get
 * a box; circles and regular polygons (triangle…octagon) get a prism recess —
 * offset outward by the clearance `cc` on every edge — that holds the pieces
 * snugly inside an otherwise rectangular container.
 */
function shapeCavity(M: ManifoldStatic, c: Compartment, height: number, cc: number): Solid {
  if (c.shape === 'circle') {
    const r = c.shapeDim / 2 + cc
    return M.cylinder(height, r, r, 64).translate([c.length / 2, c.width / 2, 0])
  }
  if (isPolygon(c.shape)) {
    const def = POLYGON_SHAPES[c.shape]
    // true outward offset: the inradius grows by exactly cc
    const R = c.shapeDim * def.radius + cc / Math.cos(Math.PI / def.sides)
    let poly = M.cylinder(height, R, R, def.sides).rotate([0, 0, def.rotation])
    if (c.rotated) poly = poly.rotate([0, 0, 90])
    return poly.translate([c.length / 2, c.width / 2, 0])
  }
  return M.cube([c.length, c.width, height])
}

/**
 * Build the printable solid(s) for one print variant of a module.
 * The variant may be wider/longer than the spec (snug-fit expansion);
 * the compartment layout is centred, so the perimeter walls thicken evenly.
 */
export async function buildPrintParts(
  spec: ModuleSpec,
  variant: PrintVariant,
  s: PrinterSettings,
): Promise<PrintPart[]> {
  const { Manifold } = await getManifold()
  const cube = (x: number, y: number, z: number) => Manifold.cube([x, y, z])

  const L = variant.outer.length
  const W = variant.outer.width
  const shiftX = variant.extra.length / 2
  const shiftY = variant.extra.width / 2

  if (spec.type === 'spacer') {
    // hollow open-top box that fills a gap so neighbouring modules can't slide
    const H = variant.outer.height
    const w = s.wallThickness
    let body = cube(L, W, H)
    if (L > 2 * w + 4 && W > 2 * w + 4 && H > s.floorThickness + 2) {
      body = body.subtract(
        cube(L - 2 * w, W - 2 * w, H).translate([w, w, s.floorThickness]),
      )
    }
    return [{ name: variant.name, mesh: toMeshData(body) }]
  }

  // stack trays and wells share the same shell: open top, finger notches to
  // pinch the stack/row out — a well is a tray with the pieces stood on edge
  if (spec.type === 'stack-tray' || spec.type === 'well') {
    const c = spec.compartments[0]
    // height sync raises the floor, keeping the contents flush with the rim
    const H = variant.outer.height
    const floorZ = H - c.depth
    const cavX = (L - c.length) / 2
    const cavY = (W - c.width) / 2
    let body = cube(L, W, H).subtract(
      shapeCavity(Manifold, c, c.depth + 1, s.componentClearance).translate([cavX, cavY, floorZ]),
    )
    // finger notches through both walls on the length axis, to pinch the stack out
    const notchW = Math.min(20, c.width * 0.6)
    const notchBottom = floorZ + Math.max(2, c.depth * 0.25)
    body = body.subtract(
      cube(L + 2, notchW, H - notchBottom + 1).translate([-1, (W - notchW) / 2, notchBottom]),
    )
    return [{ name: variant.name, mesh: toMeshData(body) }]
  }

  // ----- lidded box -----
  // floor + depth + lip region, plus any height-sync growth (cavities top out
  // at the lip base, so extra height thickens the floor under them)
  const bodyH = variant.outer.height
  const lipT = Math.min(s.wallThickness, 1.6)
  const plateT = s.floorThickness

  let body = cube(L, W, bodyH)
  for (const c of spec.compartments) {
    const x = s.wallThickness + shiftX + c.x
    const y = s.wallThickness + shiftY + c.y
    // cavity tops out at the lip base; shallower stacks get a raised floor
    const z0 = bodyH - LIP_HEIGHT - c.depth
    body = body.subtract(
      shapeCavity(Manifold, c, c.depth + LIP_HEIGHT + 1, s.componentClearance).translate([x, y, z0]),
    )
  }

  // lip channel: clear a band around the interior perimeter so the lid lip
  // can descend past divider ends
  const inL = L - 2 * s.wallThickness
  const inW = W - 2 * s.wallThickness
  const band = lipT + 2 * s.lidClearance + 0.2
  let channel: Solid
  if (inL - 2 * band > 0.5 && inW - 2 * band > 0.5) {
    channel = cube(inL, inW, LIP_HEIGHT + 1).subtract(
      cube(inL - 2 * band, inW - 2 * band, LIP_HEIGHT + 3).translate([band, band, -1]),
    )
  } else {
    channel = cube(inL, inW, LIP_HEIGHT + 1)
  }
  body = body.subtract(channel.translate([s.wallThickness, s.wallThickness, bodyH - LIP_HEIGHT]))

  // lid: flat plate with a friction-fit lip ring, printed plate-down
  const lipOuterL = inL - 2 * s.lidClearance
  const lipOuterW = inW - 2 * s.lidClearance
  const lipH = LIP_HEIGHT - 0.3 // don't bottom out on the channel floor
  let lid = cube(L, W, plateT)
  if (lipOuterL > 1 && lipOuterW > 1) {
    let lip = cube(lipOuterL, lipOuterW, lipH)
    if (lipOuterL - 2 * lipT > 0.5 && lipOuterW - 2 * lipT > 0.5) {
      lip = lip.subtract(
        cube(lipOuterL - 2 * lipT, lipOuterW - 2 * lipT, lipH + 2).translate([lipT, lipT, -1]),
      )
    }
    lid = lid.add(lip.translate([(L - lipOuterL) / 2, (W - lipOuterW) / 2, plateT]))
  }

  return [
    { name: `${variant.name} box`, mesh: toMeshData(body) },
    { name: `${variant.name} lid`, mesh: toMeshData(lid) },
  ]
}
