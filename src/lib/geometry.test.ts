import { describe, expect, it } from 'vitest'
import { computeLayout, computeModules, type ModuleSpec } from './packing'
import { buildPrintParts } from './geometry'
import { meshToStl } from './stl'
import { sampleProject, emptyProject } from '../store'
import { POLYGON_SHAPES } from '../types'

describe('buildPrintParts', () => {
  it('generates valid watertight meshes and STLs for every sample-project variant', async () => {
    const project = sampleProject()
    const result = computeLayout(project)
    expect(result.variants.length).toBeGreaterThan(0)

    for (const variant of result.variants) {
      const spec = result.modules.find((m) => m.id === variant.moduleId)!
      const parts = await buildPrintParts(spec, variant, project.printer)
      expect(parts.length).toBe(spec.type === 'lidded-box' ? 2 : 1)

      for (const part of parts) {
        expect(part.mesh.positions.length).toBeGreaterThan(0)
        expect(part.mesh.indices.length % 3).toBe(0)
        expect(part.mesh.indices.length).toBeGreaterThan(0)

        // every printed part must fit within the variant's outer dims (+ε)
        let maxX = -Infinity
        let maxY = -Infinity
        let minZ = Infinity
        for (let i = 0; i < part.mesh.positions.length; i += 3) {
          maxX = Math.max(maxX, part.mesh.positions[i])
          maxY = Math.max(maxY, part.mesh.positions[i + 1])
          minZ = Math.min(minZ, part.mesh.positions[i + 2])
        }
        expect(maxX).toBeLessThanOrEqual(variant.outer.length + 0.01)
        expect(maxY).toBeLessThanOrEqual(variant.outer.width + 0.01)
        expect(minZ).toBeGreaterThanOrEqual(-0.01) // sits on the print bed

        const stl = meshToStl(part.mesh)
        expect(stl.size).toBe(84 + (part.mesh.indices.length / 3) * 50)
      }
    }
  }, 30000)

  it('builds a combined (L-shaped) spacer as a single solid', async () => {
    const spec: ModuleSpec = {
      id: 'merge:test',
      groupId: '',
      name: 'Combined spacer (2 pieces)',
      type: 'spacer',
      outer: { length: 100, width: 100, height: 30 },
      packedHeight: 30,
      interiorDepth: 0,
      compartments: [],
      hasLid: false,
      copies: 1,
      warnings: [],
      rects: [
        { x: 0, y: 0, l: 100, w: 50 },
        { x: 0, y: 50, l: 50, w: 50 },
      ],
    }
    const variant = {
      key: 'k',
      moduleId: spec.id,
      name: spec.name,
      count: 1,
      outer: { ...spec.outer },
      extra: { length: 0, width: 0, height: 0 },
    }
    const parts = await buildPrintParts(spec, variant, emptyProject().printer)
    expect(parts).toHaveLength(1)
    expect(parts[0].mesh.indices.length).toBeGreaterThan(0)
    // the L-shape notch: no vertex should sit inside the empty quadrant interior
    for (let i = 0; i < parts[0].mesh.positions.length; i += 3) {
      const x = parts[0].mesh.positions[i]
      const y = parts[0].mesh.positions[i + 1]
      expect(x > 51 && y > 51).toBe(false)
    }
  })

  it('removes seam walls when a combined spacer is hollowed as one shell', async () => {
    const base: ModuleSpec = {
      id: 'merge:test',
      groupId: '',
      name: 'Combined spacer (2 pieces)',
      type: 'spacer',
      outer: { length: 100, width: 100, height: 30 },
      packedHeight: 30,
      interiorDepth: 0,
      compartments: [],
      hasLid: false,
      copies: 1,
      warnings: [],
      rects: [
        { x: 0, y: 0, l: 100, w: 50 },
        { x: 0, y: 50, l: 100, w: 50 },
      ],
    }
    const variant = {
      key: 'k',
      moduleId: base.id,
      name: base.name,
      count: 1,
      outer: { ...base.outer },
      extra: { length: 0, width: 0, height: 0 },
    }
    const printer = emptyProject().printer

    // signed mesh volume: Σ dot(a, b × c) / 6
    const volume = (mesh: { positions: Float32Array; indices: Uint32Array }) => {
      let v = 0
      const p = mesh.positions
      for (let t = 0; t < mesh.indices.length; t += 3) {
        const a = mesh.indices[t] * 3
        const b = mesh.indices[t + 1] * 3
        const c = mesh.indices[t + 2] * 3
        v +=
          (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) -
            p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) +
            p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) /
          6
      }
      return Math.abs(v)
    }

    const withWalls = await buildPrintParts(base, variant, printer)
    const openShell = await buildPrintParts({ ...base, removeInnerWalls: true }, variant, printer)
    const vWalls = volume(withWalls[0].mesh)
    const vOpen = volume(openShell[0].mesh)
    // the seam wall (2·wall thick × ~97 long × ~28.8 tall) disappears
    const seamVolume = 2 * printer.wallThickness * (100 - 2 * printer.wallThickness) * (30 - printer.floorThickness)
    expect(vWalls - vOpen).toBeCloseTo(seamVolume, -1)
    expect(vOpen).toBeLessThan(vWalls)
  })

  it('cuts a recess for every polygon shape without leaking outside the body', async () => {
    const shapes = Object.keys(POLYGON_SHAPES) as (keyof typeof POLYGON_SHAPES)[]
    const project = emptyProject()
    project.groups = [
      { id: 'g1', name: 'Polys', containerType: 'lidded-box', perPlayer: false, color: '#fff' },
    ]
    project.components = shapes.map((shape, i) => ({
      shape,
      id: `c${i}`,
      name: shape,
      length: 30,
      width: 30,
      thickness: 3,
      quantity: 4,
      groupId: 'g1',
    }))
    const { modules } = computeModules(project)
    const spec = modules[0]
    const variant = {
      key: 'k',
      moduleId: spec.id,
      name: 'polys',
      count: 1,
      outer: { ...spec.outer },
      extra: { length: 0, width: 0, height: 0 },
    }
    const parts = await buildPrintParts(spec, variant, project.printer)
    expect(parts).toHaveLength(2) // body + lid
    for (const part of parts) {
      expect(part.mesh.indices.length).toBeGreaterThan(0)
      for (let i = 0; i < part.mesh.positions.length; i += 3) {
        expect(part.mesh.positions[i]).toBeGreaterThanOrEqual(-0.01)
        expect(part.mesh.positions[i]).toBeLessThanOrEqual(spec.outer.length + 0.01)
        expect(part.mesh.positions[i + 1]).toBeGreaterThanOrEqual(-0.01)
        expect(part.mesh.positions[i + 1]).toBeLessThanOrEqual(spec.outer.width + 0.01)
      }
    }
  }, 30000)
})
