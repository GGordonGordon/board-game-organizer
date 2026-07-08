# Project Status

Last updated: 2026-07-05 (session "gbo_fable5")

## Done ✅

- [x] Requirements gathered and recorded in `docs/SPEC.md`
- [x] Project scaffold: Vite + React 19 + TS strict (hand-rolled; create-vite
      wouldn't run non-interactively). npm needs `--cache ./.npm-cache` here.
- [x] Domain model (`src/types.ts`)
- [x] Packing engine (`src/lib/packing.ts`): module sizing, stack splitting,
      compartment shelf-packing, per-player copies, layered box packing with
      rotation, snug-fit expansion, print-variant consolidation, warnings
- [x] Geometry (`src/lib/geometry.ts`): lidded box + plug lid, stack tray with
      finger notches, via manifold-3d CSG
- [x] Binary STL writer + downloads; ZIP-of-everything export (jszip)
- [x] zustand store with localStorage persistence, JSON export/import, sample project
- [x] Full UI: setup/printer panel, groups, components, layout results,
      3D preview (r3f), export panel
- [x] 12 unit tests passing (`npm test`); `npm run build` clean;
      dev server verified serving
- [x] **Piece shapes** (second pass, same day): rect / circle / hex / cards per
      component. Shaped recesses cut into containers (hex prism, cylinder) via
      `shapeCavity()` in geometry.ts; packing uses `footprintOf()` bounding
      boxes (hex = across-flats × 2/√3 across corners). Card size presets in
      `CARD_SIZES` (types.ts) with custom option; card thickness per card.
      localStorage migration (persist v2) + JSON import default legacy
      components to 'rect'. 18 tests passing.
- [x] **Floor-first packing + hover inspection** (third pass, same day):
      `computeLayout` now tries target module heights boxH/n (n≤4, ≥25 mm
      layers) and picks the best floor coverage — tall towers become flat wide
      modules lying across the floor; stacking only when the floor is full.
      `PackResult.floorCoverage` shown in ResultsPanel. Hovering a module in
      the 3D preview highlights it (others dim) and shows a tooltip: name,
      copy #, printed size, layer, rotation, contents. 20 tests passing.
      Sample project: 1 layer, ~33 mm tall, 63% coverage (was ~65 mm towers).
- [x] **Well container + spacers** (fourth pass, same day): 'well' container
      type stores pieces on edge (stack pivots 90°, edges face up; vertical dim
      = largest piece dim that fits the box height; same shell as stack tray).
      `generateSpacers` printer option (default on, persist v3): hollow
      open-top spacer boxes auto-fill floor gaps ≥ 10 mm (row ends, strips
      behind narrow modules, leftover width) — sample layout now tiles 100% of
      the floor plan. ModuleType = ContainerType | 'spacer'. 24 tests passing.
- [x] **Bed-split spacers + height sync** (fifth pass, same day): oversized
      spacers split into an even grid of identical bed-sized sections (one
      module, copies=N). `syncModuleHeights` option (default on, persist v4):
      every module in a layer prints at the layer height — trays/wells get a
      raised floor (contents flush with rim), lidded boxes taller walls.
      PrintVariant.extra.height carries the delta; geometry reads heights from
      the variant, not the spec. Sample: single 57.2 mm flat deck, all spacer
      sections ≤ bed. 27 tests passing.
- [x] **Manual drag layout** (sixth pass, same day): drag modules in the 3D
      preview (snapshots auto layout into `project.manualLayout`; packManual
      in packing.ts). Snap-to-flush against walls/neighbours, overlap
      prevented during drag, above-box-height warns but is allowed. Selected
      module: Rotate 90° + well↔tray pivot ("Stand on edge"/"Lay flat").
      Spacers toggle in the preview toolbar; in manual mode spacers fill free
      floor via subtractRect. "Auto arrange" resets. 32 tests passing.
- [x] **Sync button + flush dragging** (seventh pass, same day): height sync
      is now a toggle button in the preview toolbar ("Sync heights" /
      "Heights synced ✓"), default OFF (persist v5 forces it off for old
      saves); SetupPanel checkbox removed. Drag collision got slide-resolve:
      pushing into a neighbour stops flush at its face and slides along the
      contact axis. While dragging, hover highlighting on other modules is
      suppressed (no dimming/flicker during alignment). 32 tests passing.
- [x] **Polygon shapes triangle→octagon** (eighth pass, same day):
      POLYGON_SHAPES table in types.ts (sides, flat-side-down rotation,
      circumradius + bbox per measured unit, caliper label). footprintOf /
      new cavityFootprint in packing.ts; shapeCavity cuts n-gon prisms with
      true offset clearance (inradius grows by exactly cc — Compartment
      .shapeDim is now the RAW measured dim, clearance applied in geometry).
      Shape dropdown: Rectangle, Circle, Triangle, Pentagon, Hexagon,
      Heptagon, Octagon, Cards. 36 tests passing.
- [x] **3MF + OpenSCAD export** (ninth pass, 2026-07-07): format selector in
      the Print files panel (STL / 3MF / OpenSCAD), applies to part buttons
      and the ZIP. 3MF: lib/threeMF.ts (jszip package, mm units, named
      objects, parts laid side by side). OpenSCAD: lib/scad.ts emits editable
      source mirroring geometry.ts (keep in sync!). export.test.ts round-trips
      the 3MF and checks $fn per polygon. 41 tests passing.

- [x] **Published + deployed** (2026-07-07): repo at
      https://github.com/GGordonGordon/board-game-organizer (Grant's personal
      account), live on Cloudflare Workers Builds — auto-deploys on push to
      main. Build `npm run build`, deploy `npx wrangler deploy`
      (wrangler.jsonc serves dist/ as static assets).

- [x] **Spacer combining + coord entry + printer presets** (tenth pass,
      2026-07-08): ⌘/Ctrl-click multi-selects spacers → "Combine into one
      print" (touching, same layer; stored in project.spacerMerges; L-shapes
      supported via ModuleSpec.rects; warn-only when exceeding the bed;
      "Split combined spacer" undoes). Auto + manual packing share
      fillLayerSpacers (free-rect fill; merges claimed first). Selected
      module panel gained typed X/Y micro-adjustment. PRINTER_PRESETS
      dropdown (Bambu/Prusa/Creality/Elegoo/Voron + custom) feeds all bed
      checks. 44 tests passing.
- [x] **Remove inner walls on combined spacers** (same day): checkbox when
      combining (default on) + toggle on selected merges. One-shell hollowing
      via footprint erosion (intersect ±wall translates per axis) in both
      geometry.ts and scad.ts; volume-diff test proves the seam wall is gone.
      45 tests passing.
- [x] **Module size overrides** (eleventh pass, same day): selected module
      panel gained L/W/H inputs — grow-only overrides stored in
      project.moduleSizes, applied via applySizeOverride() in computeModules
      (compartments recentred; "Reset size" clears). For aligning similar
      modules. 46 tests passing.

## Not yet verified 🔍

- [ ] Hands-on browser test: open `npm run dev`, click **Load sample**, confirm
      preview renders and STL/ZIP downloads open in a slicer
- [ ] Print a physical test module (lid fit tolerance 0.15/side may need tuning)

## Next steps 🔜 (roughly in order)

1. Browser + slicer verification of sample-project STLs; print a test module
2. Nicer lid: chamfered lip for easier insertion; optional thumb notch on box rim
3. Custom domain for the live site (Cloudflare dashboard → Worker → domains)
6. See "Out of scope for v1" list in SPEC.md for the longer roadmap

## How to resume

Read `CLAUDE.md` (architecture + gotchas), then this file. The whole pipeline is
`computeLayout()` in `src/lib/packing.ts` → `buildPrintParts()` in
`src/lib/geometry.ts`; UI is thin on top of those two pure-ish layers.

Repo: https://github.com/GGordonGordon/board-game-organizer (Grant's personal
account — deliberately NOT under Gordon Data Group; this is a hobby project).
Pushing from this machine uses the repo-local `gh auth git-credential` helper;
the gh CLI must be logged in as GGordonGordon (keychain may hold a work
account). Hosting: Cloudflare Workers Builds (the newer Workers+assets flow,
not classic Pages) — `wrangler.jsonc` names the Worker and serves `dist/`;
build command `npm run build`, deploy command `npx wrangler deploy`.
