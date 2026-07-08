# Board Game Organizer — Specification

Last updated: 2026-07-05

## Goal

A website where board gamers design custom 3D-printed storage for a game:
they enter the game box's interior dimensions and every component's dimensions
(all in **millimetres**), group components, and the app automatically calculates
a set of storage modules that fit **snugly** inside the box (nothing rattles when
the box is stored, including vertically), then exports 3D print files.

## Decisions (agreed with Grant, 2026-07-05)

| Topic | Decision |
|---|---|
| Architecture | Client-only web app (Vite + React + TS). Static-hostable. |
| 3D file generation | In-browser via manifold-3d (WASM CSG) → binary STL download. |
| Persistence | localStorage auto-save + JSON project export/import. No accounts in v1. |
| Preview | Interactive 3D preview (three.js) of modules placed in the box. |
| Player components | **One box per player** — per-player groups print N identical modules; quantities are entered per player. |
| Vertical packing | **Stacked layers allowed** — shorter modules may sit on top of each other. |

## Piece shapes (added 2026-07-05, second pass)

Each component has a shape; containers stay rectangular outside but the cavity
is cut to match the shape so pieces rest in a secure recess (e.g. a square tray
with a hexagonal recess for hex tiles):

- **Rectangle** — length × width.
- **Circle** — diameter (cylindrical recess).
- **Regular polygons** (eighth pass: triangle → octagon, defined in
  `POLYGON_SHAPES` in types.ts) — cut as n-sided prism recesses, flat side
  down. Measured by what you'd caliper: triangle = side length, pentagon /
  heptagon = width at the widest point, hexagon / octagon = width across
  flats. Cavity clearance is a true outward offset (inradius + cc), so pointy
  shapes get proportionally larger bounding boxes than +2·cc.
- **Cards** — pick from common sizes (Mini/Standard American & Euro, Poker,
  Bridge, 7 Wonders, Square 70, Tarot, Dixit) or custom; thickness is per card
  (≈0.3 mm unsleeved). Stored as flat stacks in v1 (`CARD_SIZES` in types.ts).

Packing uses the shape's bounding box; only the printed recess differs.

## Container types (v1)

1. **Lidded box** — friction-fit plug lid; interior divided into one compartment
   per component type (a stack too tall for the box is split across compartments).
   Used for e.g. all of one player's components, so setup/teardown is grab-one-box.
2. **Stack tray** — open tray sized to a stack of identical components (tiles),
   with finger notches to pinch the stack out.
3. **Well** (added 2026-07-05, fourth pass) — pieces stand ON EDGE: the stack
   pivots 90° so it runs horizontally and piece edges face up (flip through
   cards like a card box). The vertical dimension is the largest piece dimension
   that fits under the box lid (e.g. 56×87 cards stand on their long edge in a
   70 mm box). Rows longer than the box are split into multiple wells. Same
   printed shell as a stack tray (open top + finger notches), rectangular slot.

## Spacers (added 2026-07-05, fourth pass)

Optional (`printer.generateSpacers`, default on): leftover floor gaps ≥ 10 mm
(MIN_SPACER) are filled with auto-generated hollow open-top spacer boxes —
row ends, strips behind narrow modules, and the leftover box width — so each
layer tiles the floor plan edge to edge and nothing slides. Gaps < 10 mm are
still absorbed by wall thickening (snug expansion). Spacers larger than the
printer bed are split into an even grid of identical sections that each fit
the bed (fifth pass). Floor-coverage scoring counts real content only.

## Height sync (added 2026-07-05, fifth pass)

Opt-in via the **“Sync heights” button** in the preview toolbar
(`printer.syncModuleHeights`, default off since the seventh pass — pressing
the button toggles it): all modules in a layer are
printed to the layer's height so each layer forms a flat deck (boards/rulebooks
lie flat on top; no vertical rattle between modules). Trays and wells get a
raised floor — contents stay flush with the rim; lidded boxes get taller walls
(cavities keep topping out at the lip base, so the extra height thickens the
floor beneath them). Print variants carry the height delta (`extra.height`).

## Snug-fit strategy

- **Fill the floor first, then stack** (added 2026-07-05, third pass):
  `computeLayout` tries several target module heights (box height, 1/2, 1/3, 1/4
  — bounded by a 25 mm minimum layer height) and keeps the layout with the best
  floor coverage. Shorter targets split piece stacks into shorter, wider modules
  that lie flat across the box floor instead of standing as tall towers; layers
  only stack once the floor plan is full. Stacks are never split below a 12 mm
  cavity depth (MIN_SPLIT_DEPTH) to avoid absurd fragmentation. Scoring:
  fits ≫ floor coverage, with small penalties for module count and used height.
- Modules are placed layer by layer (tallest first) using greedy shelf packing
  with optional 90° rotation.
- Each layer is then expanded to fill the box footprint: leftover length/width
  is distributed across the modules in each row/shelf (walls simply get
  thicker), capped at 15 mm per axis per module. Slack beyond the cap produces
  a warning suggesting a spacer or regrouping.
- Instances of the same module that end up with different expanded sizes become
  separate print variants (labelled A/B/…).
- Vertical: layer heights stack; remaining height under the box lid > 2 mm
  produces a warning (fill with boards/rulebooks or a spacer layer).

## Manual layout (added 2026-07-05, sixth pass)

Dragging a module in the 3D preview snapshots the auto layout into
`project.manualLayout` (positions per instance + the targetLayers the sizing
was computed with, so modules don't resize under the user). In manual mode:

- Drag in the floor plane (per layer, z kept from the snapshot); positions
  snap flush to walls and same-layer neighbours (2 mm threshold) on a 0.5 mm
  grid. Overlaps are prevented with slide-resolution (seventh pass): pushing
  into a neighbour stops flush against its face, and the module keeps sliding
  along the contact axis — flush placement is the natural resting state.
- Selected-module actions: **Rotate 90°** (plan rotation, blocked with a note
  if there's no room) and **Stand on edge / Lay flat** (pivots the group
  between well and stack-tray — the module id survives, so its position keeps).
- Rising above the box interior height **warns but is allowed** (lid may bulge
  or contents sit proud); overlaps and out-of-footprint placements fail the fit.
- No snug expansion in manual mode. Spacers (toggle in the preview toolbar =
  `printer.generateSpacers`) fill the free floor of each layer via rectangle
  subtraction (`subtractRect`), so users can arrange first, then add spacers.
- "Auto arrange" clears `manualLayout` and returns to the automatic packer.
- Modules added after arranging get a first-fit free spot on the floor.

## Printer / fit settings (user-adjustable, sensible defaults)

Bed size 220×220×250, wall 1.6, floor 1.2, lid clearance 0.15/side,
component clearance 0.4/side. Modules exceeding bed or box dims are flagged.

## Export formats (added 2026-07-07, ninth pass)

Format selector in the Print files panel; applies to per-part buttons and the
ZIP:

- **STL** — binary mesh per part, print-ready (as before).
- **3MF** — one file per module: millimetre units, box + lid as separate named
  objects laid side by side. For slicers and 3D modelling software
  (Fusion 360, Blender, PrusaSlicer…). Writer in `src/lib/threeMF.ts`.
- **OpenSCAD** — editable `.scad` source per module mirroring the CSG
  (compartments, lip channel, lid, notches, polygon prisms with matching $fn).
  Users tweak dimensions and re-export from OpenSCAD. Generator in
  `src/lib/scad.ts` — must stay in sync with geometry.ts.

## Out of scope for v1 (candidate roadmap)

- Card wells (cards stored on edge / angled for browsing — flat stacks exist today)
- User accounts + server-side project storage; shareable links
- True CSG meshes in the 3D preview (currently simple colored boxes)
- Auto-generated spacer/filler pieces instead of warnings
- Manual drag-to-rearrange of the computed layout
- Splitting a module that exceeds the printer bed into dovetailed sections
- Lid engraving (game name), stacking lugs between layers
