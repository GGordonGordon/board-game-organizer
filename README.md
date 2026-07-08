# Board Game Organizer

Design custom 3D-printable storage inserts for your board games, in the browser.

Enter the game box's interior dimensions and the dimensions of every component
(millimetres), group components into containers (lidded boxes or tile stack
trays, optionally one per player), and the app automatically:

- sizes each storage module and its compartments,
- packs the modules into the box in snug layers so nothing shifts in storage,
- shows an interactive 3D preview of the layout,
- exports binary STL files (individually or as a ZIP) ready for your slicer.

Projects auto-save to your browser and can be exported/imported as JSON.

## Develop

```sh
npm install
npm run dev     # local dev server
npm test        # unit tests
npm run build   # static production build in dist/
```

See `docs/SPEC.md` for the design and `docs/STATUS.md` for current progress.
