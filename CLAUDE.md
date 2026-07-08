# Board Game Organizer (bgo)

Client-only web app for designing custom 3D-printable storage inserts for board games:
enter box + component dimensions (mm) → group components → auto-pack modules into the
box → export STL files.

**Resuming work? Read `docs/STATUS.md` first** — it tracks what is done and what's next.
Full requirements and design decisions are in `docs/SPEC.md`.

## Commands

- `npm run dev` — dev server
- `npm run test` — vitest unit tests (packing + geometry)
- `npm run build` — type-check + production build
- If npm hits cache permission errors in this sandbox, add `--cache ./.npm-cache`.

## Stack

Vite + React 19 + TypeScript (strict). zustand (state, persisted to localStorage),
@react-three/fiber + drei (3D preview), manifold-3d (WASM CSG for printable solids),
jszip (bundle export). No backend.

## Architecture

- `src/types.ts` — domain model. All dims in mm; X=length, Y=width, Z=height.
  Components have a `shape` (rect/circle/card + regular polygons triangle…
  octagon via `POLYGON_SHAPES`); circle stores diameter in `length`, polygons
  store their measured dim (side / width / across-flats per the table's
  dimLabel) in `length` (width ignored). `CARD_SIZES` holds the card presets.
- `src/lib/packing.ts` — pure layout engine. `computeLayout(project)` does:
  1. `computeModules`: per group → ModuleSpec (lidded box with shelf-packed
     compartments per component stack, or one stack-tray per component stack;
     over-tall stacks are split via `splitStacks`).
  2. `packLayout`: expands per-player copies, packs instances into the box in
     layers (greedy shelf packing, 90° rotation allowed), then makes each layer
     snug: gaps < MIN_SPACER (10 mm) are absorbed by wall thickening
     (≤ MAX_SNUG_EXPANSION per axis); larger gaps get auto-generated hollow
     spacer modules (type 'spacer', when `printer.generateSpacers`), split
     into identical bed-sized sections when oversized, so the floor tiles
     edge to edge. With `printer.syncModuleHeights`, instances grow to their
     layer's height (flat deck); the delta rides on `PrintVariant.extra.height`
     and geometry.ts reads printed heights from the VARIANT, not the spec
     (trays/wells raise the floor, lidded boxes raise the walls). Instances
     with different final dims become separate `PrintVariant`s.
     Container types: lidded-box, stack-tray (flat stacks), well (pieces on
     edge — stack pivoted 90°, vertical dim = largest piece dim fitting the
     box height; shares the tray shell in geometry.ts).
  3. `computeLayout` runs 1+2 for several target module heights (boxH/n, n≤4,
     layers ≥25 mm) and keeps the best floor coverage: fill the box's
     length × width with flat modules first, stack only when the floor is full.
  4. If `project.manualLayout` exists, `packManual` replaces 2+3: user-dragged
     positions (module sizing pinned via manualLayout.targetLayers), no snug
     expansion, spacers fill free floor per layer via `subtractRect`.
     Overlap/out-of-bounds fail the fit; above-box-height only warns.
     Preview3D owns the drag UX (snap, slide-resolve collision so modules
     rest flush against neighbours, rotate, well↔tray pivot, typed X/Y
     micro-adjustment) and writes through store.setManualPosition. Height
     sync is a toolbar toggle button (`syncModuleHeights`, default off).
     Spacer fill is shared by auto+manual (`fillLayerSpacers`): user merges
     from project.spacerMerges are claimed first (one module with `rects`,
     L-shapes allowed, warn-only on bed overflow), then free rects get
     auto spacers. Bed checks everywhere use printer.bed* (set via
     PRINTER_PRESETS dropdown or custom).
- `src/lib/geometry.ts` — manifold-3d CSG. Cavities are cut with
  `shapeCavity()` — rect → cube, circle → 64-segment cylinder, polygons →
  n-segment cylinder per POLYGON_SHAPES (rotates with the compartment) — so
  pieces rest in a shape-matched recess inside a rectangular container.
  Clearance is a true outward offset (inradius + cc); Compartment.shapeDim is
  the raw measured dim and `cavityFootprint()` in packing.ts must stay in
  sync with shapeCavity's offset math. Lidded box = shell − compartment
  cavities − lip channel; separate friction-fit plug lid (plate + lip ring,
  printed plate-down). Stack tray = shell − cavity − finger notches.
- `src/lib/stl.ts` — binary STL writer. `src/lib/threeMF.ts` — 3MF package
  writer (mm units, named objects). `src/lib/scad.ts` — OpenSCAD source
  generator; it duplicates geometry.ts's construction in .scad text, so any
  geometry change must be mirrored there (export.test.ts guards the basics).
  `src/lib/download.ts` — save helpers.
- `src/store.ts` — zustand store + `sampleProject()`; persisted under key `bgo-project`.
- `src/components/*` — panels (Setup, Groups, Components, Results, Export) and
  `Preview3D` (simple colored boxes, not full CSG meshes — preview is decoupled
  from WASM on purpose).

## Invariants / gotchas

- `computeLayout` must stay pure (called from `useMemo`).
- Lidded-box `packedHeight` = body + lid plate; the lid plate thickness reuses
  `floorThickness`. Lip height constant `LIP_HEIGHT` lives in packing.ts because
  module heights depend on it.
- Compartment cavities top out at the lip base (shallow stacks get raised
  floors) so contents sit flush and are easy to grab.
- Packing works on bounding boxes via `footprintOf()` (packing.ts) — never read
  `component.length/width` directly for layout math.
- Legacy data (persist v1, old JSON exports) lacks `shape`; migrations default
  it to 'rect' (store.ts `migrate`, ExportPanel import).
- manifold-3d must stay in `optimizeDeps.exclude` in vite.config.ts.
- Geometry tests run manifold's WASM in Node — keep them Node-compatible.
