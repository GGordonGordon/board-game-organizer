import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  DEFAULT_PRINTER,
  type BoxDims,
  type ComponentGroup,
  type GameComponent,
  type ManualPlacement,
  type ModuleSizeOverride,
  type PrinterSettings,
  type Project,
  type SpacerMerge,
} from './types'

const uid = () => crypto.randomUUID().slice(0, 8)

export function emptyProject(): Project {
  return {
    name: 'My Game',
    playerCount: 4,
    box: { length: 280, width: 280, height: 70 },
    components: [],
    groups: [],
    printer: { ...DEFAULT_PRINTER },
  }
}

export function sampleProject(): Project {
  const gPlayer: ComponentGroup = {
    id: uid(),
    name: 'Player Components',
    containerType: 'lidded-box',
    perPlayer: true,
    color: '#e0723c',
  }
  const gTiles: ComponentGroup = {
    id: uid(),
    name: 'Terrain Tiles',
    containerType: 'stack-tray',
    perPlayer: false,
    color: '#4c9f70',
  }
  const gTokens: ComponentGroup = {
    id: uid(),
    name: 'Shared Tokens',
    containerType: 'lidded-box',
    perPlayer: false,
    color: '#5b8dd9',
  }
  const gCards: ComponentGroup = {
    id: uid(),
    name: 'Cards',
    containerType: 'well',
    perPlayer: false,
    color: '#b56dc4',
  }
  const comp = (
    groupId: string,
    name: string,
    shape: GameComponent['shape'],
    length: number,
    width: number,
    thickness: number,
    quantity: number,
    cardSizeId?: string,
  ): GameComponent => ({ id: uid(), groupId, name, shape, length, width, thickness, quantity, cardSizeId })

  return {
    name: 'Sample Game',
    playerCount: 4,
    box: { length: 280, width: 280, height: 70 },
    groups: [gPlayer, gTiles, gTokens, gCards],
    components: [
      comp(gPlayer.id, 'Worker meeple', 'rect', 16, 16, 10, 6),
      comp(gPlayer.id, 'Resource cube', 'rect', 8, 8, 8, 10),
      comp(gPlayer.id, 'Player disc', 'circle', 20, 20, 4, 4),
      comp(gTiles.id, 'Hex terrain tile', 'hex', 60, 60, 2, 30),
      comp(gTokens.id, 'Coin', 'circle', 22, 22, 2.5, 30),
      comp(gTokens.id, 'First player token', 'rect', 35, 35, 5, 1),
      comp(gCards.id, 'Event cards', 'card', 56, 87, 0.3, 40, 'standard-american'),
    ],
    printer: { ...DEFAULT_PRINTER },
  }
}

interface Store {
  project: Project
  setName: (name: string) => void
  setPlayerCount: (n: number) => void
  setBox: (box: Partial<BoxDims>) => void
  setPrinter: (p: Partial<PrinterSettings>) => void
  addComponent: () => void
  updateComponent: (id: string, patch: Partial<GameComponent>) => void
  removeComponent: (id: string) => void
  addGroup: () => void
  updateGroup: (id: string, patch: Partial<ComponentGroup>) => void
  removeGroup: (id: string) => void
  enterManualLayout: (targetLayers: number, positions: Record<string, ManualPlacement>) => void
  setManualPosition: (id: string, placement: ManualPlacement) => void
  clearManualLayout: () => void
  addSpacerMerge: (merge: SpacerMerge, replaceIds?: string[]) => void
  removeSpacerMerge: (id: string) => void
  setModuleSize: (id: string, patch: ModuleSizeOverride) => void
  clearModuleSize: (id: string) => void
  loadProject: (p: Project) => void
  loadSample: () => void
  reset: () => void
}

const GROUP_COLORS = ['#e0723c', '#4c9f70', '#5b8dd9', '#b56dc4', '#c9a227', '#d16a6a', '#4fa8a8']

export const useStore = create<Store>()(
  persist(
    (set) => ({
      project: emptyProject(),

      setName: (name) => set((s) => ({ project: { ...s.project, name } })),
      setPlayerCount: (playerCount) =>
        set((s) => ({ project: { ...s.project, playerCount: Math.max(1, Math.round(playerCount)) } })),
      setBox: (box) => set((s) => ({ project: { ...s.project, box: { ...s.project.box, ...box } } })),
      setPrinter: (p) =>
        set((s) => ({ project: { ...s.project, printer: { ...s.project.printer, ...p } } })),

      addComponent: () =>
        set((s) => {
          const firstGroup = s.project.groups[0]
          if (!firstGroup) return s
          const c: GameComponent = {
            id: uid(),
            name: 'New component',
            shape: 'rect',
            length: 20,
            width: 20,
            thickness: 5,
            quantity: 1,
            groupId: firstGroup.id,
          }
          return { project: { ...s.project, components: [...s.project.components, c] } }
        }),
      updateComponent: (id, patch) =>
        set((s) => ({
          project: {
            ...s.project,
            components: s.project.components.map((c) => (c.id === id ? { ...c, ...patch } : c)),
          },
        })),
      removeComponent: (id) =>
        set((s) => ({
          project: { ...s.project, components: s.project.components.filter((c) => c.id !== id) },
        })),

      addGroup: () =>
        set((s) => {
          const g: ComponentGroup = {
            id: uid(),
            name: `Group ${s.project.groups.length + 1}`,
            containerType: 'lidded-box',
            perPlayer: false,
            color: GROUP_COLORS[s.project.groups.length % GROUP_COLORS.length],
          }
          return { project: { ...s.project, groups: [...s.project.groups, g] } }
        }),
      updateGroup: (id, patch) =>
        set((s) => ({
          project: {
            ...s.project,
            groups: s.project.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
          },
        })),
      removeGroup: (id) =>
        set((s) => ({
          project: {
            ...s.project,
            groups: s.project.groups.filter((g) => g.id !== id),
            components: s.project.components.filter((c) => c.groupId !== id),
          },
        })),

      enterManualLayout: (targetLayers, positions) =>
        set((s) => ({ project: { ...s.project, manualLayout: { targetLayers, positions } } })),
      setManualPosition: (id, placement) =>
        set((s) => {
          if (!s.project.manualLayout) return s
          return {
            project: {
              ...s.project,
              manualLayout: {
                ...s.project.manualLayout,
                positions: { ...s.project.manualLayout.positions, [id]: placement },
              },
            },
          }
        }),
      clearManualLayout: () =>
        set((s) => ({ project: { ...s.project, manualLayout: undefined, spacerMerges: undefined } })),
      addSpacerMerge: (merge, replaceIds = []) =>
        set((s) => ({
          project: {
            ...s.project,
            spacerMerges: [
              ...(s.project.spacerMerges ?? []).filter((m) => !replaceIds.includes(m.id)),
              merge,
            ],
          },
        })),
      removeSpacerMerge: (id) =>
        set((s) => ({
          project: {
            ...s.project,
            spacerMerges: (s.project.spacerMerges ?? []).filter((m) => m.id !== id),
          },
        })),
      setModuleSize: (id, patch) =>
        set((s) => ({
          project: {
            ...s.project,
            moduleSizes: {
              ...(s.project.moduleSizes ?? {}),
              [id]: { ...(s.project.moduleSizes?.[id] ?? {}), ...patch },
            },
          },
        })),
      clearModuleSize: (id) =>
        set((s) => {
          const sizes = { ...(s.project.moduleSizes ?? {}) }
          delete sizes[id]
          return { project: { ...s.project, moduleSizes: sizes } }
        }),

      loadProject: (project) => set({ project }),
      loadSample: () => set({ project: sampleProject() }),
      reset: () => set({ project: emptyProject() }),
    }),
    {
      name: 'bgo-project',
      version: 5, // migrate() backfills any printer settings added since v1
      partialize: (s) => ({ project: s.project }),
      migrate: (persisted, version) => {
        // v1 components had no shape field; v2 printer had no generateSpacers;
        // v5 turned height sync from always-on into an explicit button
        const s = persisted as { project?: Project }
        if (s?.project) {
          s.project.printer = { ...DEFAULT_PRINTER, ...s.project.printer }
          if (version < 5) s.project.printer.syncModuleHeights = false
          s.project.components = (s.project.components ?? []).map((c) => ({
            ...c,
            shape: c.shape ?? 'rect',
          }))
        }
        return s
      },
    },
  ),
)
