import { useRef, useState } from 'react'
import JSZip from 'jszip'
import { useStore } from '../store'
import { buildPrintParts } from '../lib/geometry'
import { meshToStl } from '../lib/stl'
import { partsTo3mf } from '../lib/threeMF'
import { moduleToScad } from '../lib/scad'
import { sanitizeFileName, saveBlob } from '../lib/download'
import type { PackResult, PrintVariant } from '../lib/packing'
import { DEFAULT_PRINTER, type Project } from '../types'

function mm(v: number) {
  return Math.round(v * 10) / 10
}

type ExportFormat = 'stl' | '3mf' | 'scad'

const FORMAT_HINT: Record<ExportFormat, string> = {
  stl: 'STL — print-ready mesh for slicers',
  '3mf': '3MF — mesh with units and named parts, for slicers and 3D modelling software',
  scad: 'OpenSCAD — editable source; tweak dimensions, render, re-export',
}

export function ExportPanel({ result }: { result: PackResult }) {
  const project = useStore((s) => s.project)
  const loadProject = useStore((s) => s.loadProject)
  const loadSample = useStore((s) => s.loadSample)
  const reset = useStore((s) => s.reset)
  const [busy, setBusy] = useState<string | null>(null)
  const [format, setFormat] = useState<ExportFormat>('stl')
  const fileInput = useRef<HTMLInputElement>(null)

  function specFor(v: PrintVariant) {
    const spec = result.modules.find((m) => m.id === v.moduleId)
    if (!spec) throw new Error(`module ${v.moduleId} not found`)
    return spec
  }

  /** file name → blob, in the selected format */
  async function filesFor(v: PrintVariant): Promise<[string, Blob][]> {
    const spec = specFor(v)
    const base = sanitizeFileName(v.name)
    if (format === 'scad') {
      const src = moduleToScad(spec, v, project.printer)
      return [[`${base}.scad`, new Blob([src], { type: 'text/plain' })]]
    }
    const parts = await buildPrintParts(spec, v, project.printer)
    if (format === '3mf') {
      return [[`${base}.3mf`, await partsTo3mf(parts)]]
    }
    return parts.map((p) => [`${sanitizeFileName(p.name)}.stl`, meshToStl(p.mesh)])
  }

  async function downloadVariant(v: PrintVariant) {
    setBusy(v.key)
    try {
      const files = await filesFor(v)
      for (const [name, blob] of files) {
        saveBlob(name, blob)
        // brief pause so the browser doesn't swallow back-to-back downloads
        if (files.length > 1) await new Promise((r) => setTimeout(r, 400))
      }
    } catch (e) {
      alert(`Export failed: ${e instanceof Error ? e.message : e}`)
    } finally {
      setBusy(null)
    }
  }

  async function downloadAllZip() {
    setBusy('zip')
    try {
      const zip = new JSZip()
      for (const v of result.variants) {
        for (const [name, blob] of await filesFor(v)) {
          zip.file(name, blob)
        }
      }
      zip.file('project.json', JSON.stringify(project, null, 2))
      const blob = await zip.generateAsync({ type: 'blob' })
      saveBlob(`${sanitizeFileName(project.name)}_modules.zip`, blob)
    } catch (e) {
      alert(`Export failed: ${e instanceof Error ? e.message : e}`)
    } finally {
      setBusy(null)
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
    saveBlob(`${sanitizeFileName(project.name)}.json`, blob)
  }

  function importJson(file: File) {
    file.text().then((text) => {
      try {
        const p = JSON.parse(text) as Project
        if (!p.box || !Array.isArray(p.components) || !Array.isArray(p.groups) || !p.printer) {
          throw new Error('not a Board Game Organizer project file')
        }
        // files exported by older versions: default missing fields
        p.components = p.components.map((c) => ({ ...c, shape: c.shape ?? 'rect' }))
        p.printer = { ...DEFAULT_PRINTER, ...p.printer }
        loadProject(p)
      } catch (e) {
        alert(`Import failed: ${e instanceof Error ? e.message : e}`)
      }
    })
  }

  return (
    <section className="panel">
      <h2>Print files</h2>
      <div className="format-row">
        <label className="field">
          <span>Format</span>
          <select value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}>
            <option value="stl">STL</option>
            <option value="3mf">3MF</option>
            <option value="scad">OpenSCAD</option>
          </select>
        </label>
        <span className="hint">{FORMAT_HINT[format]}</span>
      </div>
      {result.variants.length === 0 && (
        <p className="hint">Modules will appear here once the layout has content.</p>
      )}
      {result.variants.length > 0 && (
        <div className="table-wrap">
          <table>
          <thead>
            <tr>
              <th>Part</th>
              <th>Printed size (mm)</th>
              <th>Print</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {result.variants.map((v) => (
              <tr key={v.key}>
                <td>{v.name}</td>
                <td>
                  {mm(v.outer.length)} × {mm(v.outer.width)} × {mm(v.outer.height)}
                  {(v.extra.length > 0.05 || v.extra.width > 0.05) && (
                    <span className="hint"> (snug-fit padded)</span>
                  )}
                </td>
                <td>×{v.count}</td>
                <td>
                  <button disabled={busy !== null} onClick={() => downloadVariant(v)}>
                    {busy === v.key ? 'Building…' : format.toUpperCase()}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      )}
      <div className="button-row">
        <button
          className="primary"
          disabled={busy !== null || result.variants.length === 0}
          onClick={downloadAllZip}
        >
          {busy === 'zip' ? 'Building…' : 'Download all (.zip)'}
        </button>
        <button onClick={exportJson}>Export project (.json)</button>
        <button onClick={() => fileInput.current?.click()}>Import project</button>
        <button onClick={loadSample}>Load sample</button>
        <button
          className="danger"
          onClick={() => {
            if (confirm('Clear the current project?')) reset()
          }}
        >
          Reset
        </button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) importJson(f)
          e.target.value = ''
        }}
      />
    </section>
  )
}
