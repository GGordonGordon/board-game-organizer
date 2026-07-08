import type { PackResult } from '../lib/packing'
import type { Project } from '../types'

const TYPE_LABEL = {
  'lidded-box': 'Box + lid',
  'stack-tray': 'Stack tray',
  well: 'Well (on edge)',
  spacer: 'Spacer',
} as const

function mm(v: number) {
  return Math.round(v * 10) / 10
}

export function ResultsPanel({ project, result }: { project: Project; result: PackResult }) {
  const { box, groups } = project
  const groupColor = new Map(groups.map((g) => [g.id, g.color]))
  const hasContent = result.instances.length > 0

  return (
    <section className="panel">
      <h2>
        Layout{' '}
        {hasContent && (
          <span className={`badge ${result.fits ? 'ok' : 'bad'}`}>
            {result.fits ? 'Fits' : 'Does not fit'}
          </span>
        )}
      </h2>
      {!hasContent && <p className="hint">Add groups and components to calculate the layout.</p>}
      {hasContent && (
        <>
          <p className="hint">
            {result.layers.length} layer{result.layers.length === 1 ? '' : 's'}, {mm(result.usedHeight)} /{' '}
            {box.height} mm of box height used, {Math.round(result.floorCoverage * 100)}% of the
            floor plan covered, {result.instances.length} modules total.{' '}
            {result.mode === 'manual'
              ? 'Manual layout — drag modules in the preview; "Auto arrange" resets.'
              : 'Hover the preview to inspect a module; drag one to arrange manually.'}
          </p>
          <div className="table-wrap">
            <table>
            <thead>
              <tr>
                <th>Module</th>
                <th>Type</th>
                <th>Body size (mm)</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {result.modules.map((m) => (
                <tr key={m.id}>
                  <td>
                    <span className="dot" style={{ background: groupColor.get(m.groupId) }} />
                    {m.name}
                  </td>
                  <td>{TYPE_LABEL[m.type]}</td>
                  <td>
                    {mm(m.outer.length)} × {mm(m.outer.width)} × {mm(m.outer.height)}
                  </td>
                  <td>×{m.copies}</td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </>
      )}
      {result.warnings.length > 0 && (
        <ul className="warnings">
          {result.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
