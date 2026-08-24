import { Page } from './Page'
import { Link } from '../router'
import { SITE_EMAIL, SITE_NAME, REPO_URL } from '../site'

export function About() {
  return (
    <Page
      title={`About ${SITE_NAME}`}
      subtitle="A free browser tool for designing 3D-printable storage inserts that fit your board games."
    >
      <h2>What it does</h2>
      <p>
        Board game boxes are packed for the shelf, not for the table. Punched cardboard,
        loose meeples, sleeved cards and a dozen resource types end up in plastic baggies
        that spill on the first bump. {SITE_NAME} lets you design a custom insert — a set of
        trays, lidded boxes and spacers — that fills your box exactly and puts every
        component where you can grab it.
      </p>
      <p>
        You measure your box and your components in millimetres, group the components the
        way you want them stored, and the app works out the module sizes, packs them into
        the box, and generates printable 3D geometry you can export and slice. Everything
        runs in your browser — there is no account, no upload and no waiting on a server.
      </p>

      <h2>How it works</h2>
      <ol>
        <li>
          <strong>Set up the box.</strong> Enter the interior length, width and height of
          your game box, plus your printer's bed size, wall and floor thickness, and the
          clearance you want around each piece.
        </li>
        <li>
          <strong>Add components.</strong> Cards, meeples, discs, dice, tiles and coins —
          each with its own shape (rectangle, circle, card preset, or a regular polygon from
          triangle to octagon), quantity and stack count.
        </li>
        <li>
          <strong>Group them.</strong> Decide what shares a container: a lidded box for
          small loose bits, a stack tray for flat stacks of tiles, or a well that holds
          pieces on edge so you can flick them out with a fingertip.
        </li>
        <li>
          <strong>Let it pack.</strong> The layout engine sizes each module, tries several
          module heights, and picks the arrangement with the best floor coverage — filling
          the box floor before it stacks anything. Leftover gaps become hollow spacers so
          nothing slides around in transit.
        </li>
        <li>
          <strong>Adjust by hand.</strong> Drag modules in the 3D preview, rotate them,
          pivot a tray into a well, or type exact coordinates. The app re-checks the fit as
          you go and tells you when something overlaps or overflows.
        </li>
        <li>
          <strong>Export and print.</strong> Download STL or 3MF files for each part, an
          OpenSCAD source file if you want to keep editing the geometry yourself, or a
          single ZIP of everything.
        </li>
      </ol>

      <h2>What you get</h2>
      <ul>
        <li>Shape-matched recesses — a round disc rests in a cylinder, a hex tile in a hex pocket.</li>
        <li>Friction-fit plug lids on closed boxes, finger notches on open trays.</li>
        <li>Per-player copies of a module generated automatically.</li>
        <li>Bed-size checks, so nothing exported is too big to print.</li>
        <li>Optional Gridfinity-compatible bases.</li>
        <li>Printer presets, plus per-project JSON save and load.</li>
      </ul>

      <h2>Who makes it</h2>
      <p>
        {SITE_NAME} is an independent side project built and maintained by one person, not a
        company. It is free to use, funded by nothing, and it will stay that way. If it
        saves you an evening of measuring and re-measuring, there is a tip jar in the
        footer — entirely optional.
      </p>
      <p>
        Questions, bug reports and feature requests are all welcome at{' '}
        <a href={`mailto:${SITE_EMAIL}`}>{SITE_EMAIL}</a>, or see the{' '}
        <Link to="/contact">contact page</Link>. The source lives on{' '}
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
        .
      </p>

      <h2>What it is not</h2>
      <p>
        {SITE_NAME} is not affiliated with, endorsed by, or sponsored by any board game
        publisher or manufacturer. It does not sell inserts, print anything for you, or ship
        physical products — it produces design files that you print yourself or hand to a
        printing service. Game names you type into your own projects are used only to label
        your designs and stay on your device.
      </p>
    </Page>
  )
}
