import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { About } from './About'
import { Privacy } from './Privacy'
import { Terms } from './Terms'
import { Contact } from './Contact'
import { normalizePath, ROUTES } from '../router'
import { ROUTE_META } from '../meta'
import { SITE_EMAIL, SITE_URL } from '../site'
// Read as text so these assertions cover the files that actually ship.
import sitemap from '../../public/sitemap.xml?raw'
import robots from '../../public/robots.txt?raw'
import indexHtml from '../../index.html?raw'

const PAGES = { About, Privacy, Terms, Contact }

describe('static content pages', () => {
  for (const [name, C] of Object.entries(PAGES)) {
    // These pages exist to satisfy ad-network / landing-page review: each one
    // must actually render and must carry a reachable contact address.
    it(`${name} renders and shows the contact email`, () => {
      const html = renderToStaticMarkup(<C />)
      expect(html.length).toBeGreaterThan(500)
      expect(html).toContain(`mailto:${SITE_EMAIL}`)
    })
  }

  it('privacy policy discloses the local-storage key it uses', () => {
    expect(renderToStaticMarkup(<Privacy />)).toContain('bgo-project')
  })

  it('terms link to the privacy policy', () => {
    expect(renderToStaticMarkup(<Terms />)).toContain('href="/privacy"')
  })
})

describe('routing', () => {
  it('keeps known routes, tolerating trailing slash and case', () => {
    for (const r of ROUTES) expect(normalizePath(r)).toBe(r)
    expect(normalizePath('/Privacy/')).toBe('/privacy')
    expect(normalizePath('/terms///')).toBe('/terms')
  })

  it('falls back to the designer for unknown paths', () => {
    expect(normalizePath('/nope')).toBe('/')
    expect(normalizePath('')).toBe('/')
  })
})

describe('crawlable metadata', () => {
  it('gives every route its own title and description', () => {
    for (const r of ROUTES) {
      const meta = ROUTE_META[r]
      expect(meta?.title, r).toBeTruthy()
      expect(meta?.description.length, r).toBeGreaterThan(50)
    }
    const titles = ROUTES.map((r) => ROUTE_META[r].title)
    expect(new Set(titles).size).toBe(ROUTES.length)
  })

  it('lists every route in the sitemap', () => {
    for (const r of ROUTES) {
      expect(sitemap, r).toContain(`<loc>${SITE_URL}${r === '/' ? '/' : r}</loc>`)
    }
  })

  it('points robots, sitemap and the html canonical at the canonical host', () => {
    expect(robots).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`)
    expect(indexHtml).toContain(`<link rel="canonical" href="${SITE_URL}/" />`)
  })
})
