import { Page } from './Page'
import { SITE_EMAIL, SITE_NAME, POLICY_UPDATED } from '../site'

export function Privacy() {
  return (
    <Page title="Privacy Policy" subtitle={`Last updated: ${POLICY_UPDATED}`}>
      <p>
        {SITE_NAME} is a client-side web application. It runs entirely in your browser. There
        is no account system, no login, and no server that receives, stores or processes the
        designs you create. This policy explains, in plain terms, what happens to your
        information when you use the site.
      </p>

      <h2>Information we collect</h2>
      <p>
        <strong>We do not collect personal information.</strong> We do not ask for your name,
        email address, postal address, phone number or payment details, and there is no form
        on this site that transmits anything to us. The only way we learn who you are is if
        you choose to email us.
      </p>

      <h2>Information stored on your device</h2>
      <p>
        Your project — box dimensions, component lists, groups, printer settings and any
        manual layout you drag out — is saved in your browser's <em>local storage</em> under
        the key <code>bgo-project</code>. This is what lets you close the tab and pick up
        where you left off. That data:
      </p>
      <ul>
        <li>never leaves your device and is never transmitted to us or to anyone else;</li>
        <li>is readable only by this site, in this browser, on this device;</li>
        <li>
          is deleted whenever you clear your browser's site data for this domain, or use the
          app's own reset/clear controls.
        </li>
      </ul>
      <p>
        We do not use cookies. Local storage is used for saving your work, not for tracking
        you across sites.
      </p>

      <h2>Files you export</h2>
      <p>
        STL, 3MF, OpenSCAD and ZIP files are generated in your browser and saved straight to
        your computer through the normal browser download. Nothing is uploaded, queued or
        rendered on a server, and we never see the models you produce. Likewise, JSON project
        files you import are read locally in the page.
      </p>

      <h2>Hosting and server logs</h2>
      <p>
        The site is served as static files by Cloudflare. Like any web host, Cloudflare
        processes standard technical request data — such as IP address, browser user agent,
        the time of the request and which files were served — in order to deliver the page
        and protect the service from abuse. This is handled by Cloudflare under its own
        privacy terms; we do not build profiles from it, and we do not combine it with
        anything else.
      </p>

      <h2>Analytics and advertising</h2>
      <p>
        {SITE_NAME} does not currently run analytics, advertising, remarketing or tracking
        tags of any kind. No third-party script runs on the page. If that ever changes, this
        section will be updated <em>before</em> any such tag goes live, naming the provider,
        what it collects and how to opt out.
      </p>

      <h2>Links to other sites</h2>
      <p>
        The footer links to Buy Me a Coffee (an optional tip jar) and the project's source
        code on GitHub. If you follow one of those links you leave this site, and the
        destination's own privacy policy and cookies apply. Any payment you choose to make is
        handled entirely by Buy Me a Coffee — we never see or store your payment details.
      </p>

      <h2>Children</h2>
      <p>
        This site is a design tool intended for a general audience. It is not directed at
        children under 13, and because it collects no personal information, it does not
        knowingly collect anything from them.
      </p>

      <h2>Your rights</h2>
      <p>
        Privacy laws such as the GDPR and the CCPA give you rights to access, correct, export
        or delete the personal data a service holds about you. Because we hold no personal
        data about you, there is nothing for us to look up or erase — and the project data on
        your device is already fully under your control: you can export it to a JSON file at
        any time, and clearing your browser storage removes it permanently. We do not sell or
        share personal information, because we do not have any. If you have a question about
        any of this, write to us at the address below.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If this policy changes, the revised version will be posted on this page with a new
        "last updated" date. Material changes — particularly anything that would start
        collecting data — will be described here in specific terms rather than in general
        ones.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy can be sent to{' '}
        <a href={`mailto:${SITE_EMAIL}`}>{SITE_EMAIL}</a>. {SITE_NAME} is an independent
        personal project, and that address reaches the person who maintains it.
      </p>
    </Page>
  )
}
