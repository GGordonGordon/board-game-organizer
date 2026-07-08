import { useStore } from '../store'
import { TextField } from './Field'
import type { ContainerType } from '../types'

export function GroupsPanel() {
  const groups = useStore((s) => s.project.groups)
  const addGroup = useStore((s) => s.addGroup)
  const updateGroup = useStore((s) => s.updateGroup)
  const removeGroup = useStore((s) => s.removeGroup)

  return (
    <section className="panel">
      <h2>Groups</h2>
      <p className="hint">
        Components in a group are stored together in one container. Mark a group “per player” to
        print an identical container for each player. In a <em>well</em>, pieces stand on edge
        (card edges face up, flip through like a card box) instead of lying flat.
      </p>
      {groups.length > 0 && (
        <div className="table-wrap">
          <table>
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Container</th>
              <th>Per player</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.id}>
                <td>
                  <input
                    type="color"
                    className="swatch"
                    value={g.color}
                    onChange={(e) => updateGroup(g.id, { color: e.target.value })}
                  />
                </td>
                <td>
                  <TextField value={g.name} onChange={(v) => updateGroup(g.id, { name: v })} />
                </td>
                <td>
                  <select
                    value={g.containerType}
                    onChange={(e) =>
                      updateGroup(g.id, { containerType: e.target.value as ContainerType })
                    }
                  >
                    <option value="lidded-box">Box with lid</option>
                    <option value="stack-tray">Stack tray (flat)</option>
                    <option value="well">Well (on edge)</option>
                  </select>
                </td>
                <td className="center">
                  <input
                    type="checkbox"
                    checked={g.perPlayer}
                    onChange={(e) => updateGroup(g.id, { perPlayer: e.target.checked })}
                  />
                </td>
                <td>
                  <button className="ghost" title="Delete group and its components" onClick={() => removeGroup(g.id)}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      )}
      <button onClick={addGroup}>+ Add group</button>
    </section>
  )
}
