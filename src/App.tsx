import { useMemo } from 'react'
import { useStore } from './store'
import { computeLayout } from './lib/packing'
import { SetupPanel } from './components/SetupPanel'
import { GroupsPanel } from './components/GroupsPanel'
import { ComponentsPanel } from './components/ComponentsPanel'
import { ResultsPanel } from './components/ResultsPanel'
import { Preview3D } from './components/Preview3D'
import { ExportPanel } from './components/ExportPanel'

export default function App() {
  const project = useStore((s) => s.project)
  const result = useMemo(() => computeLayout(project), [project])

  return (
    <div className="app">
      <header>
        <h1>Board Game Organizer</h1>
        <span className="subtitle">custom 3D-printable storage inserts · all sizes in mm</span>
      </header>
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
    </div>
  )
}
