import { useEffect } from 'react'
import type { Route } from './router'
import { SITE_NAME, SITE_URL } from './site'

type Meta = { title: string; description: string }

/** Per-route <title>/description. Kept here rather than in the page components
 *  so the crawlable defaults in index.html and these stay easy to compare. */
export const ROUTE_META: Record<Route, Meta> = {
  '/': {
    title: `${SITE_NAME} — Custom 3D-Printable Board Game Inserts`,
    description:
      'Free browser tool for designing custom 3D-printable board game inserts. Enter your box and component sizes, group your pieces, and export STL, 3MF or OpenSCAD files. Runs entirely in your browser — nothing is uploaded.',
  },
  '/about': {
    title: `About — ${SITE_NAME}`,
    description:
      'What Board Game Organizer does, how the packing workflow fits trays, lidded boxes and spacers into your game box, and who builds it.',
  },
  '/privacy': {
    title: `Privacy Policy — ${SITE_NAME}`,
    description:
      'Board Game Organizer collects no personal information. Projects stay in your browser, exports are generated on your device, and no analytics or advertising tags run on the site.',
  },
  '/terms': {
    title: `Terms of Use — ${SITE_NAME}`,
    description:
      'Terms of use for Board Game Organizer: your designs stay yours, printing is at your own risk, and the tool is provided free and as-is.',
  },
  '/contact': {
    title: `Contact — ${SITE_NAME}`,
    description: `Get in touch about Board Game Organizer — bug reports, fit and tolerance problems, and feature requests.`,
  },
}

function tag(selector: string, create: () => HTMLElement): HTMLElement {
  let el = document.head.querySelector<HTMLElement>(selector)
  if (!el) {
    el = create()
    document.head.appendChild(el)
  }
  return el
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  const el = tag(`meta[${attr}="${key}"]`, () => {
    const m = document.createElement('meta')
    m.setAttribute(attr, key)
    return m
  })
  el.setAttribute('content', content)
}

/** Keeps title, description, canonical and og:* in step with the current route.
 *  Without this an SPA reports the homepage's metadata on every page, which
 *  reads as thin/duplicated content to crawlers and ad reviewers. */
export function useRouteMeta(route: Route) {
  useEffect(() => {
    const { title, description } = ROUTE_META[route]
    const url = SITE_URL + (route === '/' ? '/' : route)

    document.title = title
    setMeta('name', 'description', description)
    setMeta('property', 'og:title', title)
    setMeta('property', 'og:description', description)
    setMeta('property', 'og:url', url)

    const canonical = tag('link[rel="canonical"]', () => {
      const l = document.createElement('link')
      l.setAttribute('rel', 'canonical')
      return l
    })
    canonical.setAttribute('href', url)
  }, [route])
}
