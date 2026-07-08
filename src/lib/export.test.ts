import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { computeLayout, computeModules } from './packing'
import { buildPrintParts } from './geometry'
import { partsTo3mf } from './threeMF'
import { moduleToScad } from './scad'
import { sampleProject } from '../store'
import type { PrintVariant } from './packing'

function variantFor(spec: { id: string; name: string; outer: { length: number; width: number; height: number } }): PrintVariant {
  return {
    key: 'k',
    moduleId: spec.id,
    name: spec.name,
    count: 1,
    outer: { ...spec.outer },
    extra: { length: 0, width: 0, height: 0 },
  }
}

describe('3MF export', () => {
  it('produces a valid 3MF package with named parts in millimetres', async () => {
    const project = sampleProject()
    const result = computeLayout(project)
    const lidded = result.modules.find((m) => m.type === 'lidded-box')!
    const parts = await buildPrintParts(lidded, variantFor(lidded), project.printer)
    const blob = await partsTo3mf(parts)

    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    expect(zip.file('[Content_Types].xml')).toBeTruthy()
    expect(zip.file('_rels/.rels')).toBeTruthy()
    const model = await zip.file('3D/3dmodel.model')!.async('string')
    expect(model).toContain('unit="millimeter"')
    expect(model).toContain('<vertex')
    expect(model).toContain('<triangle')
    // both parts present and named (box + lid)
    expect((model.match(/<object /g) ?? []).length).toBe(2)
    expect(model).toContain('name="')
    expect((model.match(/<item /g) ?? []).length).toBe(2)
  })
})

describe('OpenSCAD export', () => {
  const project = sampleProject()
  const result = computeLayout(project)

  it('emits editable source for a lidded box with shaped cavities', () => {
    const lidded = result.modules.find((m) => m.type === 'lidded-box' && m.compartments.some((c) => c.shape === 'circle'))!
    const src = moduleToScad(lidded, variantFor(lidded), project.printer)
    expect(src).toContain('difference()')
    expect(src).toContain('cube([')
    expect(src).toContain('$fn=64') // circular recess
    expect(src).toContain('// ---- lid')
    expect(src).toContain('lip channel')
  })

  it('emits a hex prism for hex tile trays', () => {
    const tray = result.modules.find((m) => m.type === 'stack-tray')!
    const src = moduleToScad(tray, variantFor(tray), project.printer)
    expect(src).toContain('$fn=6')
    expect(src).toContain('finger notches')
  })

  it('emits wells and spacers', () => {
    const well = result.modules.find((m) => m.type === 'well')!
    expect(moduleToScad(well, variantFor(well), project.printer)).toContain('stand on edge')
    const spacer = result.modules.find((m) => m.type === 'spacer')!
    expect(moduleToScad(spacer, variantFor(spacer), project.printer)).toContain('spacer')
  })

  it('covers every polygon shape with the right $fn', () => {
    const p = sampleProject()
    p.groups = [{ id: 'g1', name: 'Polys', containerType: 'lidded-box', perPlayer: false, color: '#fff' }]
    p.components = (['triangle', 'pentagon', 'heptagon', 'octagon'] as const).map((shape, i) => ({
      shape,
      id: `c${i}`,
      name: shape,
      length: 30,
      width: 30,
      thickness: 3,
      quantity: 4,
      groupId: 'g1',
    }))
    p.manualLayout = undefined
    const { modules } = computeModules(p)
    const src = moduleToScad(modules[0], variantFor(modules[0]), p.printer)
    for (const fn of [3, 5, 7, 8]) expect(src).toContain(`$fn=${fn}`)
  })
})
