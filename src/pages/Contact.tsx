import { Page } from './Page'
import { SITE_EMAIL, SITE_NAME, SUPPORT_URL, REPO_URL } from '../site'

export function Contact() {
  return (
    <Page
      title="Contact"
      subtitle="One person maintains this site, and this address reaches them directly."
    >
      <p className="contact-email">
        <a href={`mailto:${SITE_EMAIL}`}>{SITE_EMAIL}</a>
      </p>

      <h2>What to write about</h2>
      <ul>
        <li>
          <strong>Something is broken.</strong> Tell us what you were doing, what you
          expected, and what happened instead. Your browser and operating system help. If you
          can, export your project to JSON and attach it — it makes a bug reproducible in
          seconds.
        </li>
        <li>
          <strong>A part did not fit or did not print.</strong> Send the dimensions you
          entered, your printer and slicer, and a photo if you have one. Tolerance problems
          are the most useful reports we get.
        </li>
        <li>
          <strong>You want a feature.</strong> A new piece shape, a container type, a printer
          preset, an export format — say what you are trying to store and why the current
          tools do not cover it.
        </li>
        <li>
          <strong>Privacy, terms or anything legal.</strong> Same address; those go straight
          to the maintainer.
        </li>
      </ul>

      <h2>Response times</h2>
      <p>
        {SITE_NAME} is a free side project, not a staffed business, so replies are best-effort
        and usually take a few days. Every message is read.
      </p>

      <h2>Other places</h2>
      <ul>
        <li>
          Source code and issue tracker:{' '}
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
            github.com/GGordonGordon/board-game-organizer
          </a>
        </li>
        <li>
          Tip jar, if the tool saved you an evening:{' '}
          <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
            Buy me a coffee
          </a>
        </li>
      </ul>
    </Page>
  )
}
