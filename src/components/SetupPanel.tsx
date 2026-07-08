import { useStore } from '../store'
import { NumField, TextField } from './Field'
import { PRINTER_PRESETS } from '../types'

export function SetupPanel() {
  const project = useStore((s) => s.project)
  const setName = useStore((s) => s.setName)
  const setPlayerCount = useStore((s) => s.setPlayerCount)
  const setBox = useStore((s) => s.setBox)
  const setPrinter = useStore((s) => s.setPrinter)
  const { box, printer } = project

  return (
    <section className="panel">
      <h2>Game</h2>
      <div className="field-row">
        <TextField label="Game name" value={project.name} onChange={setName} />
        <NumField label="Players" value={project.playerCount} onChange={setPlayerCount} min={1} />
      </div>
      <h3>Box interior (mm)</h3>
      <div className="field-row">
        <NumField label="Length" value={box.length} onChange={(v) => setBox({ length: v })} />
        <NumField label="Width" value={box.width} onChange={(v) => setBox({ width: v })} />
        <NumField label="Height" value={box.height} onChange={(v) => setBox({ height: v })} />
      </div>
      <p className="hint">
        Measure the usable interior. If the board or rulebooks lie on top of the insert, subtract
        their thickness from the height.
      </p>
      <details>
        <summary>Printer &amp; fit settings</summary>
        <div className="field-row">
          <label className="field">
            <span>Printer / print volume</span>
            <select
              value={
                PRINTER_PRESETS.find(
                  (p) =>
                    p.bedLength === printer.bedLength &&
                    p.bedWidth === printer.bedWidth &&
                    p.bedHeight === printer.bedHeight,
                )?.id ?? 'custom'
              }
              onChange={(e) => {
                const p = PRINTER_PRESETS.find((pr) => pr.id === e.target.value)
                if (p) {
                  setPrinter({ bedLength: p.bedLength, bedWidth: p.bedWidth, bedHeight: p.bedHeight })
                }
              }}
            >
              {PRINTER_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.bedLength} × {p.bedWidth} × {p.bedHeight})
                </option>
              ))}
              <option value="custom">Custom…</option>
            </select>
          </label>
        </div>
        <p className="hint">
          Modules, spacers, and combined spacers are checked against this print volume — anything
          too large is flagged in the layout warnings.
        </p>
        <div className="field-row">
          <NumField label="Bed length" value={printer.bedLength} onChange={(v) => setPrinter({ bedLength: v })} />
          <NumField label="Bed width" value={printer.bedWidth} onChange={(v) => setPrinter({ bedWidth: v })} />
          <NumField label="Bed height" value={printer.bedHeight} onChange={(v) => setPrinter({ bedHeight: v })} />
        </div>
        <div className="field-row">
          <NumField
            label="Wall (mm)"
            value={printer.wallThickness}
            step={0.2}
            onChange={(v) => setPrinter({ wallThickness: v })}
          />
          <NumField
            label="Floor (mm)"
            value={printer.floorThickness}
            step={0.2}
            onChange={(v) => setPrinter({ floorThickness: v })}
          />
        </div>
        <div className="field-row">
          <NumField
            label="Lid clearance"
            value={printer.lidClearance}
            step={0.05}
            title="Per-side gap between lid lip and box wall"
            onChange={(v) => setPrinter({ lidClearance: v })}
          />
          <NumField
            label="Piece clearance"
            value={printer.componentClearance}
            step={0.1}
            title="Per-side gap around pieces inside a cavity"
            onChange={(v) => setPrinter({ componentClearance: v })}
          />
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={printer.generateSpacers}
            onChange={(e) => setPrinter({ generateSpacers: e.target.checked })}
          />
          <span>Fill leftover gaps with printed spacer boxes (stops modules sliding around)</span>
        </label>
        <p className="hint">
          Height syncing (shorter modules raised to a flat deck) is the “Sync heights” button in
          the preview.
        </p>
      </details>
    </section>
  )
}
