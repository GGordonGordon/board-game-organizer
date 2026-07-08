import { useStore } from '../store'
import { NumField, TextField } from './Field'
import { CARD_SIZES, POLYGON_SHAPES, isPolygon, type GameComponent, type PieceShape } from '../types'

// ordered by number of sides, with circle first and cards last
const SHAPE_OPTIONS: { value: PieceShape; label: string }[] = [
  { value: 'circle', label: 'Circle' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'rect', label: 'Rectangle' },
  { value: 'pentagon', label: 'Pentagon' },
  { value: 'hex', label: 'Hexagon' },
  { value: 'heptagon', label: 'Heptagon' },
  { value: 'octagon', label: 'Octagon' },
  { value: 'card', label: 'Cards' },
]

export function ComponentsPanel() {
  const components = useStore((s) => s.project.components)
  const groups = useStore((s) => s.project.groups)
  const addComponent = useStore((s) => s.addComponent)
  const updateComponent = useStore((s) => s.updateComponent)
  const removeComponent = useStore((s) => s.removeComponent)

  function changeShape(c: GameComponent, shape: PieceShape) {
    if (shape === 'card') {
      const preset = CARD_SIZES.find((cs) => cs.id === 'standard-american')!
      updateComponent(c.id, {
        shape,
        cardSizeId: preset.id,
        length: preset.length,
        width: preset.width,
        thickness: 0.3,
      })
    } else if (shape === 'circle' || isPolygon(shape)) {
      updateComponent(c.id, { shape, width: c.length })
    } else {
      updateComponent(c.id, { shape })
    }
  }

  function changeCardSize(c: GameComponent, id: string) {
    const preset = CARD_SIZES.find((cs) => cs.id === id)
    if (preset) {
      updateComponent(c.id, { cardSizeId: id, length: preset.length, width: preset.width })
    } else {
      updateComponent(c.id, { cardSizeId: 'custom' })
    }
  }

  function sizeCell(c: GameComponent) {
    const shape = c.shape ?? 'rect'
    if (shape === 'circle' || isPolygon(shape)) {
      return (
        <NumField
          value={c.length}
          step={0.5}
          title={shape === 'circle' ? 'Diameter' : POLYGON_SHAPES[shape].dimLabel}
          onChange={(v) => updateComponent(c.id, { length: v, width: v })}
        />
      )
    }
    if (shape === 'card') {
      const isCustom = !CARD_SIZES.some((cs) => cs.id === c.cardSizeId)
      return (
        <div className="size-cell">
          <select
            value={isCustom ? 'custom' : c.cardSizeId}
            onChange={(e) => changeCardSize(c, e.target.value)}
          >
            {CARD_SIZES.map((cs) => (
              <option key={cs.id} value={cs.id}>
                {cs.name} ({cs.length} × {cs.width})
              </option>
            ))}
            <option value="custom">Custom…</option>
          </select>
          {isCustom && (
            <>
              <NumField value={c.length} step={0.5} title="Card width" onChange={(v) => updateComponent(c.id, { length: v })} />
              <NumField value={c.width} step={0.5} title="Card height" onChange={(v) => updateComponent(c.id, { width: v })} />
            </>
          )}
        </div>
      )
    }
    return (
      <div className="size-cell">
        <NumField value={c.length} step={0.5} title="Length" onChange={(v) => updateComponent(c.id, { length: v })} />
        <NumField value={c.width} step={0.5} title="Width" onChange={(v) => updateComponent(c.id, { width: v })} />
      </div>
    )
  }

  return (
    <section className="panel">
      <h2>Components</h2>
      <p className="hint">
        Measure each piece lying flat. Rectangles: length × width. Circles: diameter. Hexagons and
        octagons: width across the flats. Triangles: side length. Pentagons and heptagons: width
        at the widest point. Cards: pick a standard size or enter a custom one — thickness is per
        card (≈0.3 mm unsleeved, ≈0.45 mm sleeved). For per-player groups, enter the quantity for
        one player. Hover the size field for what to measure.
      </p>
      {components.length > 0 && (
        <div className="table-wrap">
          <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Shape</th>
              <th>Size (mm)</th>
              <th>Thick.</th>
              <th>Qty</th>
              <th>Group</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {components.map((c) => (
              <tr key={c.id}>
                <td>
                  <TextField value={c.name} onChange={(v) => updateComponent(c.id, { name: v })} />
                </td>
                <td>
                  <select
                    value={c.shape ?? 'rect'}
                    onChange={(e) => changeShape(c, e.target.value as PieceShape)}
                  >
                    {SHAPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{sizeCell(c)}</td>
                <td>
                  <NumField value={c.thickness} step={0.05} onChange={(v) => updateComponent(c.id, { thickness: v })} />
                </td>
                <td>
                  <NumField value={c.quantity} onChange={(v) => updateComponent(c.id, { quantity: Math.round(v) })} />
                </td>
                <td>
                  <select
                    value={c.groupId}
                    onChange={(e) => updateComponent(c.id, { groupId: e.target.value })}
                  >
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <button className="ghost" onClick={() => removeComponent(c.id)}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      )}
      <button onClick={addComponent} disabled={groups.length === 0}>
        + Add component
      </button>
      {groups.length === 0 && <p className="hint">Create a group first.</p>}
    </section>
  )
}
