import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { Edges, OrbitControls } from '@react-three/drei'
import { useStore } from '../store'
import type { PackResult, PlacedInstance } from '../lib/packing'
import type { Project } from '../types'

const S = 0.1 // mm → scene units
const GAP = 0.6 // visual shrink so neighbouring modules are distinguishable
const SNAP = 2 // mm: snap flush against walls and neighbours while dragging

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

export function Preview3D({ project, result }: { project: Project; result: PackResult }) {
  const { box, groups } = project
  const enterManualLayout = useStore((s) => s.enterManualLayout)
  const setManualPosition = useStore((s) => s.setManualPosition)
  const clearManualLayout = useStore((s) => s.clearManualLayout)
  const setPrinter = useStore((s) => s.setPrinter)
  const updateGroup = useStore((s) => s.updateGroup)

  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
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
  const selected = selectedId ? instById.get(selectedId) : undefined
  const selectedModule = selected ? moduleById.get(selected.moduleId) : undefined
  const selectedGroup = selectedModule
    ? groups.find((g) => g.id === selectedModule.groupId)
    : undefined
  const hoveredModule = hovered ? moduleById.get(hovered.moduleId) : undefined

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

  function beginDrag(e: ThreeEvent<PointerEvent>, inst: PlacedInstance) {
    if (isSpacer(inst)) return
    e.stopPropagation()
    setSelectedId(inst.id)
    setHoveredId(null) // no hover effects while dragging — keeps alignment calm
    setNote(null)
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
        x = Math.min(x, o.x - inst.length) // moving right: stop at its left face
      } else if (x < inst.x && inst.x >= o.x + o.length - 0.01 && x < o.x + o.length) {
        x = Math.max(x, o.x + o.length) // moving left: stop at its right face
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
      // last resort: try each axis alone so the module can still slide
      if (!others.some((o) => xyOverlap({ ...inst, x }, o))) y = inst.y
      else if (!others.some((o) => xyOverlap({ ...inst, y }, o))) x = inst.x
      else return
    }
    setManualPosition(inst.id, { x, y, z: inst.z, rotated: inst.rotated })
  }

  function endDrag() {
    setDragId(null)
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

  const dragInst = dragId ? instById.get(dragId) : undefined

  return (
    <div className="preview" style={{ cursor: dragId ? 'grabbing' : hovered ? 'pointer' : 'grab' }}>
      <Canvas
        camera={{ position: [camDist, camDist * 0.8, camDist], fov: 40 }}
        onPointerMissed={() => setSelectedId(null)}
        onPointerUp={endDrag}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[8, 20, 12]} intensity={1.4} />
        <lineSegments geometry={boxEdges} position={[0, (box.height * S) / 2, 0]}>
          <lineBasicMaterial color="#7a8090" />
        </lineSegments>
        {result.instances.map((inst) => {
          const isHovered = hoveredId === inst.id
          const isSelected = selectedId === inst.id
          const spacer = isSpacer(inst)
          return (
            <mesh
              key={inst.id}
              position={[
                (inst.x + inst.length / 2 - box.length / 2) * S,
                (inst.z + inst.height / 2) * S,
                (inst.y + inst.width / 2 - box.width / 2) * S,
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
              onPointerDown={spacer ? undefined : (e) => beginDrag(e, inst)}
            >
              <boxGeometry
                args={[
                  Math.max(1, inst.length - GAP) * S,
                  Math.max(1, inst.height - GAP) * S,
                  Math.max(1, inst.width - GAP) * S,
                ]}
              />
              <meshStandardMaterial
                color={colorByModule.get(inst.moduleId)}
                roughness={0.65}
                emissive={isHovered || isSelected ? colorByModule.get(inst.moduleId) : '#000000'}
                emissiveIntensity={isSelected ? 0.55 : isHovered ? 0.4 : 0}
                transparent
                opacity={spacer ? 0.45 : hoveredId && !isHovered && !isSelected ? 0.4 : 0.95}
              />
              <Edges color={isSelected ? '#ffffff' : isHovered ? '#d8dbe2' : '#14161b'} />
            </mesh>
          )
        })}
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
              setSelectedId(null)
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

      {selected && selectedModule && (
        <div className="preview-sel">
          <strong>{selectedModule.name}</strong>
          <span className="muted">
            {mm(selected.length)} × {mm(selected.width)} × {mm(selected.height)} mm
          </span>
          <button onClick={rotateSelected}>Rotate 90°</button>
          {pivotable && (
            <button onClick={pivotSelected} title="Pivot the stack: flat (backs up) ↔ on edge (edges up)">
              {selectedGroup!.containerType === 'well' ? 'Lay flat (opening up)' : 'Stand on edge'}
            </button>
          )}
          <button onClick={() => setSelectedId(null)}>Done</button>
          {note && <span className="sel-note">{note}</span>}
        </div>
      )}
    </div>
  )
}
