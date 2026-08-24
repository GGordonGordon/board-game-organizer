import { useMemo } from 'react'
import { useStore } from './store'
import { computeLayout } from './lib/packing'
import { SetupPanel } from './components/SetupPanel'
import { GroupsPanel } from './components/GroupsPanel'
import { ComponentsPanel } from './components/ComponentsPanel'
import { ResultsPanel } from './components/ResultsPanel'
import { Preview3D } from './components/Preview3D'
import { ExportPanel } from './components/ExportPanel'
import { About } from './pages/About'
import { Privacy } from './pages/Privacy'
import { Terms } from './pages/Terms'
import { Contact } from './pages/Contact'
import { Link, useRoute } from './router'
import { useRouteMeta } from './meta'
import { SITE_EMAIL, SUPPORT_URL } from './site'

function Designer() {
  const project = useStore((s) => s.project)
  const result = useMemo(() => computeLayout(project), [project])

  return (
    <main>
      <div className="col">
        <SetupPanel />
        <GroupsPanel />
        <ComponentsPanel />
      </div>
      <div className="col">
        <Preview3D project={project} result={result} />
        <ResultsPanel project={project} result={result} />
        <ExportPanel result={result} />
      </div>
    </main>
  )
}

export default function App() {
  const route = useRoute()
  useRouteMeta(route)

  return (
    <div className="app">
      <header>
        <Link to="/" className="brand">
          <h1>Board Game Organizer</h1>
        </Link>
        <span className="subtitle">custom 3D-printable storage inserts · all sizes in mm</span>
        <nav className="site-nav">
          <Link to="/">Designer</Link>
          <Link to="/about">About</Link>
          <Link to="/contact">Contact</Link>
        </nav>
      </header>

      {route === '/' && <Designer />}
      {route === '/about' && <About />}
      {route === '/privacy' && <Privacy />}
      {route === '/terms' && <Terms />}
      {route === '/contact' && <Contact />}

      <footer>
        <nav className="footer-nav">
          <Link to="/about">About</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Use</Link>
          <a href={`mailto:${SITE_EMAIL}`}>{SITE_EMAIL}</a>
        </nav>
        <p className="footer-note">
          Free, runs entirely in your browser — your designs never leave your device.
          Enjoying it?{' '}
          <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
            ☕ Buy me a coffee
          </a>
        </p>
        <p className="footer-note muted">
          © {new Date().getFullYear()} Board Game Organizer. Not affiliated with any board
          game publisher.
        </p>
      </footer>
    </div>
  )
}
