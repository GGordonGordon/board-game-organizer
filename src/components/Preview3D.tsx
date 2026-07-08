import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { Edges, OrbitControls } from '@react-three/drei'
import { useStore } from '../store'
import type { PackResult, PlacedInstance } from '../lib/packing'
import type { Project, SpacerRect } from '../types'

const S = 0.1 // mm → scene units
const GAP = 0.6 // visual shrink so neighbouring modules are distinguishable
const SNAP = 2 // mm: snap flush against walls and neighbours while dragging
const TOUCH = 0.6 // mm: rects this close count as touching for combining

const TYPE_LABEL = {
  'lidded-box': 'Box with lid',
  'stack-tray': 'Stack tray',
  well: 'Well (pieces on edge)',
  spacer: 'Spacer (gap filler)',
} as const

function mm(v: number) {
  return Math.round(v * 10) / 10
}

const xyOverlap = (a: PlacedInstance, b: PlacedInstance) =>
  a.x < b.x + b.length - 0.01 &&
  b.x < a.x + a.length - 0.01 &&
  a.y < b.y + b.width - 0.01 &&
  b.y < a.y + a.width - 0.01

const zOverlap = (a: PlacedInstance, b: PlacedInstance) =>
  a.z < b.z + b.height - 0.01 && b.z < a.z + a.height - 0.01

function snapAxis(v: number, edges: number[]): number {
  for (const e of edges) {
    if (Math.abs(v - e) <= SNAP) return e
  }
  return v
}

/** are all rects connected through shared edges? (BFS) */
function rectsConnected(rects: SpacerRect[]): boolean {
  if (rects.length <= 1) return true
  const touching = (a: SpacerRect, b: SpacerRect) => {
    const xTouch = Math.abs(a.x + a.l - b.x) < TOUCH || Math.abs(b.x + b.l - a.x) < TOUCH
    const yTouch = Math.abs(a.y + a.w - b.y) < TOUCH || Math.abs(b.y + b.w - a.y) < TOUCH
    const xOverlap = a.x < b.x + b.l - TOUCH && b.x < a.x + a.l - TOUCH
    const yOverlap = a.y < b.y + b.w - TOUCH && b.y < a.y + a.w - TOUCH
    return (xTouch && yOverlap) || (yTouch && xOverlap)
  }
  const seen = new Set([0])
  const queue = [0]
  while (queue.length) {
    const i = queue.pop()!
    rects.forEach((r, j) => {
      if (!seen.has(j) && touching(rects[i], r)) {
        seen.add(j)
        queue.push(j)
      }
    })
  }
  return seen.size === rects.length
}

export function Preview3D({ project, result }: { project: Project; result: PackResult }) {
  const { box, groups } = project
  const enterManualLayout = useStore((s) => s.enterManualLayout)
  const setManualPosition = useStore((s) => s.setManualPosition)
  const clearManualLayout = useStore((s) => s.clearManualLayout)
  const setPrinter = useStore((s) => s.setPrinter)
  const updateGroup = useStore((s) => s.updateGroup)
  const addSpacerMerge = useStore((s) => s.addSpacerMerge)
  const removeSpacerMerge = useStore((s) => s.removeSpacerMerge)
  const setModuleSize = useStore((s) => s.setModuleSize)
  const clearModuleSize = useStore((s) => s.clearModuleSize)

  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [dragId, setDragId] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [combineOpen, setCombineOpen] = useState(true)
  const dragOffset = useRef({ dx: 0, dy: 0 })

  const manual = !!project.manualLayout
  const moduleById = useMemo(() => new Map(result.modules.map((m) => [m.id, m])), [result.modules])
  const instById = useMemo(() => new Map(result.instances.map((i) => [i.id, i])), [result.instances])
  const isSpacer = (inst: PlacedInstance) => moduleById.get(inst.moduleId)?.type === 'spacer'

  const colorByModule = useMemo(() => {
    const groupColor = new Map(groups.map((g) => [g.id, g.color]))
    return new Map(result.modules.map((m) => [m.id, groupColor.get(m.groupId) ?? '#8a8f9c']))
  }, [groups, result.modules])

  const boxEdges = useMemo(
    () =>
      new THREE.EdgesGeometry(
        new THREE.BoxGeometry(box.length * S, box.height * S, box.width * S),
      ),
    [box.length, box.width, box.height],
  )

  const camDist = Math.max(box.length, box.width, 100) * S * 1.4
  const hovered = hoveredId ? instById.get(hoveredId) : undefined
  const hoveredModule = hovered ? moduleById.get(hovered.moduleId) : undefined
  const selectedInsts = selectedIds
    .map((id) => instById.get(id))
    .filter((i): i is PlacedInstance => !!i)
  const selected = selectedInsts.length === 1 ? selectedInsts[0] : undefined
  const selectedModule = selected ? moduleById.get(selected.moduleId) : undefined
  const selectedGroup = selectedModule
    ? groups.find((g) => g.id === selectedModule.groupId)
    : undefined
  const multiSpacers = selectedInsts.length >= 2 && selectedInsts.every((i) => isSpacer(i))

  const hoveredContents = useMemo(() => {
    if (!hoveredModule) return []
    const byLabel = new Map<string, number>()
    for (const c of hoveredModule.compartments) {
      byLabel.set(c.label, (byLabel.get(c.label) ?? 0) + c.quantity)
    }
    return [...byLabel.entries()]
  }, [hoveredModule])

  /** snapshot the current layout into manual positions (idempotent) */
  function ensureManual() {
    if (project.manualLayout) return
    const positions: Record<string, { x: number; y: number; z: number; rotated: boolean }> = {}
    for (const inst of result.instances) {
      if (isSpacer(inst)) continue
      positions[inst.id] = { x: inst.x, y: inst.y, z: inst.z, rotated: inst.rotated }
    }
    enterManualLayout(result.targetLayers, positions)
  }

  function onModuleDown(e: ThreeEvent<PointerEvent>, inst: PlacedInstance) {
    e.stopPropagation()
    setNote(null)
    const native = e.nativeEvent
    const multi = native.ctrlKey || native.metaKey || native.shiftKey
    if (isSpacer(inst)) {
      setSelectedIds((prev) => {
        const prevAllSpacers = prev.every((id) => {
          const i = instById.get(id)
          return i && isSpacer(i)
        })
        if (multi && prevAllSpacers && prev.length > 0) {
          return prev.includes(inst.id) ? prev.filter((id) => id !== inst.id) : [...prev, inst.id]
        }
        return [inst.id]
      })
      return // spacers are selectable but not draggable
    }
    setSelectedIds([inst.id])
    setHoveredId(null) // no hover effects while dragging — keeps alignment calm
    setDragId(inst.id)
    dragOffset.current = {
      dx: e.point.x / S + box.length / 2 - inst.x,
      dy: e.point.z / S + box.width / 2 - inst.y,
    }
  }

  function onDragMove(e: ThreeEvent<PointerEvent>) {
    if (!dragId) return
    ensureManual()
    const inst = instById.get(dragId)
    if (!inst) return
    let x = e.point.x / S + box.length / 2 - dragOffset.current.dx
    let y = e.point.z / S + box.width / 2 - dragOffset.current.dy
    x = Math.min(Math.max(0, x), Math.max(0, box.length - inst.length))
    y = Math.min(Math.max(0, y), Math.max(0, box.width - inst.width))
    // snap flush to walls and same-layer neighbours
    const others = result.instances.filter(
      (o) => o.id !== inst.id && !isSpacer(o) && zOverlap(o, inst),
    )
    const xEdges = [0, box.length - inst.length]
    const yEdges = [0, box.width - inst.width]
    for (const o of others) {
      xEdges.push(o.x + o.length, o.x - inst.length)
      yEdges.push(o.y + o.width, o.y - inst.width)
    }
    x = snapAxis(x, xEdges)
    y = snapAxis(y, yEdges)

    // slide-resolve: when pushed into a neighbour, stop flush against its face
    // (per axis), so the module can rest touching and slide along it
    const spansY = (o: PlacedInstance, yy: number) =>
      yy < o.y + o.width - 0.01 && o.y < yy + inst.width - 0.01
    const spansX = (o: PlacedInstance, xx: number) =>
      xx < o.x + o.length - 0.01 && o.x < xx + inst.length - 0.01
    for (const o of others) {
      if (!spansY(o, inst.y)) continue
      if (x > inst.x && inst.x + inst.length <= o.x + 0.01 && x + inst.length > o.x) {
        x = Math.min(x, o.x - inst.length)
      } else if (x < inst.x && inst.x >= o.x + o.length - 0.01 && x < o.x + o.length) {
        x = Math.max(x, o.x + o.length)
      }
    }
    for (const o of others) {
      if (!spansX(o, x)) continue
      if (y > inst.y && inst.y + inst.width <= o.y + 0.01 && y + inst.width > o.y) {
        y = Math.min(y, o.y - inst.width)
      } else if (y < inst.y && inst.y >= o.y + o.width - 0.01 && y < o.y + o.width) {
        y = Math.max(y, o.y + o.width)
      }
    }

    x = Math.round(x * 2) / 2
    y = Math.round(y * 2) / 2
    const cand = { ...inst, x, y }
    if (others.some((o) => xyOverlap(cand, o))) {
      if (!others.some((o) => xyOverlap({ ...inst, x }, o))) y = inst.y
      else if (!others.some((o) => xyOverlap({ ...inst, y }, o))) x = inst.x
      else return
    }
    setManualPosition(inst.id, { x, y, z: inst.z, rotated: inst.rotated })
  }

  function endDrag() {
    setDragId(null)
  }

  /** typed micro-adjustment of the selected module's position */
  function setCoord(axis: 'x' | 'y', v: number) {
    if (!selected || !Number.isFinite(v)) return
    ensureManual()
    const x =
      axis === 'x' ? Math.min(Math.max(0, v), Math.max(0, box.length - selected.length)) : selected.x
    const y =
      axis === 'y' ? Math.min(Math.max(0, v), Math.max(0, box.width - selected.width)) : selected.y
    const cand = { ...selected, x, y }
    const collides = result.instances.some(
      (o) => o.id !== selected.id && !isSpacer(o) && zOverlap(o, cand) && xyOverlap(cand, o),
    )
    if (collides) {
      setNote('That position overlaps another module')
      return
    }
    setNote(null)
    setManualPosition(selected.id, { x, y, z: selected.z, rotated: selected.rotated })
  }

  function rotateSelected() {
    if (!selected) return
    ensureManual()
    const newL = selected.width
    const newW = selected.length
    const x = Math.min(Math.max(0, selected.x), Math.max(0, box.length - newL))
    const y = Math.min(Math.max(0, selected.y), Math.max(0, box.width - newW))
    const cand: PlacedInstance = { ...selected, x, y, length: newL, width: newW }
    const collides = result.instances.some(
      (o) => o.id !== selected.id && !isSpacer(o) && zOverlap(o, cand) && xyOverlap(cand, o),
    )
    if (collides) {
      setNote('No room to rotate here — move it somewhere clearer first')
      return
    }
    setNote(null)
    setManualPosition(selected.id, { x, y, z: selected.z, rotated: !selected.rotated })
  }

  const pivotable =
    selectedGroup &&
    (selectedGroup.containerType === 'stack-tray' || selectedGroup.containerType === 'well')

  function pivotSelected() {
    if (!selectedGroup) return
    setNote(null)
    updateGroup(selectedGroup.id, {
      containerType: selectedGroup.containerType === 'well' ? 'stack-tray' : 'well',
    })
  }

  function combineSelected() {
    if (selectedInsts.length < 2) return
    const z = selectedInsts[0].z
    if (!selectedInsts.every((i) => Math.abs(i.z - z) < 0.5)) {
      setNote('Select spacers on the same layer to combine them')
      return
    }
    const rects: SpacerRect[] = selectedInsts.flatMap((i) => {
      const mod = moduleById.get(i.moduleId)!
      return mod.rects?.length
        ? mod.rects.map((r) => ({ ...r, x: r.x + i.x, y: r.y + i.y }))
        : [{ x: i.x, y: i.y, l: i.length, w: i.width }]
    })
    if (!rectsConnected(rects)) {
      setNote('Only touching spacers can be combined into one piece')
      return
    }
    const replaceIds = [
      ...new Set(selectedInsts.map((i) => i.moduleId).filter((id) => id.startsWith('merge:'))),
    ]
    const id = `merge:${crypto.randomUUID().slice(0, 8)}`
    addSpacerMerge({ id, z, rects, removeInnerWalls: combineOpen }, replaceIds)
    setSelectedIds([`${id}#0`])
    setNote(null)
  }

  const selectedMerge =
    selected && selectedModule?.rects
      ? project.spacerMerges?.find((m) => m.id === selected.moduleId)
      : undefined

  const dragInst = dragId ? instById.get(dragId) : undefined

  /** render one box; merged spacers render one box per rectangle */
  function renderInstance(inst: PlacedInstance) {
    const isSelected = selectedIds.includes(inst.id)
    const isHovered = hoveredId === inst.id
    const spacer = isSpacer(inst)
    const mod = moduleById.get(inst.moduleId)
    const rects: SpacerRect[] =
      spacer && mod?.rects?.length
        ? mod.rects
        : [{ x: 0, y: 0, l: inst.length, w: inst.width }]

    const material = (
      <meshStandardMaterial
        color={colorByModule.get(inst.moduleId)}
        roughness={0.65}
        emissive={isHovered || isSelected ? colorByModule.get(inst.moduleId) : '#000000'}
        emissiveIntensity={isSelected ? 0.55 : isHovered ? 0.4 : 0}
        transparent
        opacity={spacer ? 0.45 : hoveredId && !isHovered && !isSelected ? 0.4 : 0.95}
      />
    )
    return rects.map((r, ri) => (
      <mesh
        key={`${inst.id}:${ri}`}
        position={[
          (inst.x + r.x + r.l / 2 - box.length / 2) * S,
          (inst.z + inst.height / 2) * S,
          (inst.y + r.y + r.w / 2 - box.width / 2) * S,
        ]}
        onPointerOver={(e) => {
          if (dragId) return
          e.stopPropagation()
          setHoveredId(inst.id)
        }}
        onPointerOut={() => {
          if (dragId) return
          setHoveredId((h) => (h === inst.id ? null : h))
        }}
        onPointerDown={(e) => onModuleDown(e, inst)}
      >
        <boxGeometry
          args={[
            Math.max(1, r.l - GAP) * S,
            Math.max(1, inst.height - GAP) * S,
            Math.max(1, r.w - GAP) * S,
          ]}
        />
        {material}
        <Edges color={isSelected ? '#ffffff' : isHovered ? '#d8dbe2' : '#14161b'} />
      </mesh>
    ))
  }

  return (
    <div className="preview" style={{ cursor: dragId ? 'grabbing' : hovered ? 'pointer' : 'grab' }}>
      <Canvas
        camera={{ position: [camDist, camDist * 0.8, camDist], fov: 40 }}
        onPointerMissed={() => setSelectedIds([])}
        onPointerUp={endDrag}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[8, 20, 12]} intensity={1.4} />
        <lineSegments geometry={boxEdges} position={[0, (box.height * S) / 2, 0]}>
          <lineBasicMaterial color="#7a8090" />
        </lineSegments>
        {result.instances.map((inst) => renderInstance(inst))}
        {dragInst && (
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, dragInst.z * S + 0.002, 0]}
            onPointerMove={onDragMove}
            onPointerUp={endDrag}
          >
            <planeGeometry args={[box.length * S * 4, box.width * S * 4]} />
            <meshBasicMaterial visible={false} />
          </mesh>
        )}
        <OrbitControls makeDefault enabled={!dragId} target={[0, (box.height * S) / 2, 0]} />
      </Canvas>

      <div className="preview-bar">
        <label className="check">
          <input
            type="checkbox"
            checked={project.printer.generateSpacers}
            onChange={(e) => setPrinter({ generateSpacers: e.target.checked })}
          />
          <span>Spacers</span>
        </label>
        <button
          className={project.printer.syncModuleHeights ? 'active' : ''}
          title="Raise shorter modules to a flat deck per layer (press again to undo)"
          onClick={() => setPrinter({ syncModuleHeights: !project.printer.syncModuleHeights })}
        >
          {project.printer.syncModuleHeights ? 'Heights synced ✓' : 'Sync heights'}
        </button>
        {manual && (
          <button
            onClick={() => {
              clearManualLayout()
              setSelectedIds([])
            }}
          >
            Auto arrange
          </button>
        )}
        <span className="muted">{manual ? 'Manual layout' : 'Drag a module to arrange manually'}</span>
      </div>

      {hovered && hoveredModule && !dragId && (
        <div className="preview-tip">
          <strong>{hoveredModule.name}</strong>
          {hoveredModule.copies > 1 && (
            <span className="muted"> · copy {Number(hovered.id.split('#')[1]) + 1} of {hoveredModule.copies}</span>
          )}
          <div className="muted">{TYPE_LABEL[hoveredModule.type]}</div>
          <div>
            {mm(hovered.length)} × {mm(hovered.width)} × {mm(hovered.height)} mm · layer{' '}
            {hovered.layer + 1} of {result.layers.length}
            {hovered.rotated ? ' · rotated 90°' : ''}
          </div>
          {hoveredModule.type === 'spacer' && !hoveredModule.rects && (
            <div className="muted">⌘/Ctrl-click other spacers to combine into one print</div>
          )}
          {hoveredContents.length > 0 && (
            <ul>
              {hoveredContents.map(([label, qty]) => (
                <li key={label}>
                  {qty} × {label}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {multiSpacers && (
        <div className="preview-sel">
          <strong>{selectedInsts.length} spacers selected</strong>
          <button onClick={combineSelected}>Combine into one print</button>
          <label className="check">
            <input
              type="checkbox"
              checked={combineOpen}
              onChange={(e) => setCombineOpen(e.target.checked)}
            />
            <span>Remove inner walls (one open shell, less plastic)</span>
          </label>
          <button onClick={() => setSelectedIds([])}>Done</button>
          {note && <span className="sel-note">{note}</span>}
        </div>
      )}

      {selected && selectedModule && !multiSpacers && (
        <div className="preview-sel">
          <strong>{selectedModule.name}</strong>
          <span className="muted">
            {mm(selected.length)} × {mm(selected.width)} × {mm(selected.height)} mm
          </span>
          {!isSpacer(selected) && (
            <>
              <label className="coord">
                <span>X</span>
                <input
                  type="number"
                  step={0.5}
                  value={mm(selected.x)}
                  onChange={(e) => setCoord('x', parseFloat(e.target.value))}
                />
              </label>
              <label className="coord">
                <span>Y</span>
                <input
                  type="number"
                  step={0.5}
                  value={mm(selected.y)}
                  onChange={(e) => setCoord('y', parseFloat(e.target.value))}
                />
              </label>
              <span className="muted">·</span>
              {(['length', 'width', 'height'] as const).map((dim) => (
                <label
                  className="coord"
                  key={dim}
                  title="Grow the printed size beyond the computed minimum, e.g. to match a neighbouring module (values below the minimum are ignored)"
                >
                  <span>{dim === 'length' ? 'L' : dim === 'width' ? 'W' : 'H'}</span>
                  <input
                    type="number"
                    step={0.5}
                    value={mm(selectedModule.outer[dim])}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value)
                      if (Number.isFinite(v)) setModuleSize(selectedModule.id, { [dim]: v })
                    }}
                  />
                </label>
              ))}
              {project.moduleSizes?.[selectedModule.id] && (
                <button onClick={() => clearModuleSize(selectedModule.id)}>Reset size</button>
              )}
              <button onClick={rotateSelected}>Rotate 90°</button>
              {pivotable && (
                <button
                  onClick={pivotSelected}
                  title="Pivot the stack: flat (backs up) ↔ on edge (edges up)"
                >
                  {selectedGroup!.containerType === 'well' ? 'Lay flat (opening up)' : 'Stand on edge'}
                </button>
              )}
            </>
          )}
          {isSpacer(selected) && selectedModule.rects && (
            <>
              {selectedMerge && (
                <label className="check">
                  <input
                    type="checkbox"
                    checked={!!selectedMerge.removeInnerWalls}
                    onChange={(e) =>
                      addSpacerMerge(
                        { ...selectedMerge, removeInnerWalls: e.target.checked },
                        [selectedMerge.id],
                      )
                    }
                  />
                  <span>Inner walls removed</span>
                </label>
              )}
              <button onClick={() => removeSpacerMerge(selected.moduleId)}>Split combined spacer</button>
            </>
          )}
          {isSpacer(selected) && !selectedModule.rects && (
            <span className="muted">⌘/Ctrl-click other spacers to combine</span>
          )}
          <button onClick={() => setSelectedIds([])}>Done</button>
          {note && <span className="sel-note">{note}</span>}
        </div>
      )}
    </div>
  )
}
