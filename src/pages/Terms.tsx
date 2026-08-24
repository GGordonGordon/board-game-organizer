import { Page } from './Page'
import { Link } from '../router'
import { SITE_EMAIL, SITE_NAME, POLICY_UPDATED } from '../site'

export function Terms() {
  return (
    <Page title="Terms of Use" subtitle={`Last updated: ${POLICY_UPDATED}`}>
      <p>
        By using {SITE_NAME} you agree to these terms. They are deliberately short. If you do
        not agree with them, please do not use the site.
      </p>

      <h2>1. What the service is</h2>
      <p>
        {SITE_NAME} is a free browser-based design tool that turns dimensions you enter into
        3D model files for storage inserts. It is provided at no charge, with no account and
        no subscription. We may change, suspend or discontinue it at any time without notice.
      </p>

      <h2>2. Your designs are yours</h2>
      <p>
        You keep all rights to the projects you create and the model files you export. We
        claim no ownership over them and no licence to them — we never receive them in the
        first place. You may use, modify, print, give away or sell what you produce with this
        tool, including commercially. Files you export are yours to do with as you wish.
      </p>

      <h2>3. Measurements and printing are your responsibility</h2>
      <p>
        Every layout is only as good as the numbers you type in and the printer you send it
        to. Real-world results depend on your measurements, filament shrinkage, nozzle width,
        slicer settings, tolerances and calibration. <strong>Check the fit before you commit
        a long print.</strong> We recommend printing a small test module first. {SITE_NAME}
        makes no promise that a generated part will fit your box, hold your components, or
        print without failure.
      </p>

      <h2>4. No warranty</h2>
      <p>
        The site and everything it produces are provided "as is" and "as available", without
        warranties of any kind, express or implied, including any implied warranties of
        merchantability, fitness for a particular purpose and non-infringement. We do not
        warrant that the site will be uninterrupted, error-free, or that its output will be
        accurate or suitable for your purpose.
      </p>

      <h2>5. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, we are not liable for any indirect,
        incidental, special or consequential damages, or for any loss arising from your use
        of the site — including wasted filament or print time, failed or damaged prints,
        damage to game components or equipment, or loss of project data. Because the service
        is provided free of charge, our total liability to you is limited to zero.
      </p>

      <h2>6. Your data is your backup</h2>
      <p>
        Projects are stored only in your own browser. Clearing your browser data, switching
        devices or using a private window will lose them. Use the JSON export to keep a copy
        of anything you care about. We hold no backup and cannot recover a lost project.
      </p>

      <h2>7. Acceptable use</h2>
      <p>
        Please do not attempt to disrupt or abuse the service, use it to infringe someone
        else's intellectual property, or misrepresent it as your own product or as an
        official product of a game publisher.
      </p>

      <h2>8. Trademarks and affiliation</h2>
      <p>
        {SITE_NAME} is an independent project. It is not affiliated with, endorsed by,
        sponsored by, or connected to any board game publisher, manufacturer, printer
        manufacturer or storage brand. Any game names, product names or trademarks you enter
        into your own projects remain the property of their respective owners and are used by
        you, on your own device, purely to label your designs.
      </p>

      <h2>9. Third-party links</h2>
      <p>
        The site links to Buy Me a Coffee and to GitHub. We do not control those services and
        are not responsible for their content, terms or handling of your data.
      </p>

      <h2>10. Privacy</h2>
      <p>
        Our handling of information is described in the <Link to="/privacy">Privacy Policy</Link>,
        which forms part of these terms.
      </p>

      <h2>11. Changes to these terms</h2>
      <p>
        We may update these terms; the current version always appears on this page with its
        "last updated" date. Continuing to use the site after a change means you accept the
        revised terms.
      </p>

      <h2>12. Contact</h2>
      <p>
        Questions about these terms: <a href={`mailto:${SITE_EMAIL}`}>{SITE_EMAIL}</a>.
      </p>
    </Page>
  )
}
