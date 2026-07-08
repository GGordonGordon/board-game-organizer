import { describe, expect, it } from 'vitest'
import { computeLayout, computeModules } from './packing'
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
