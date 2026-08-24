import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'

/** Routes served by the SPA. Cloudflare's `single-page-application` 404 handling
 *  returns index.html for all of them, so real paths (not hashes) work. */
export const ROUTES = ['/', '/about', '/privacy', '/terms', '/contact'] as const
export type Route = (typeof ROUTES)[number]

export function normalizePath(pathname: string): Route {
  const p = pathname.replace(/\/+$/, '').toLowerCase() || '/'
  return (ROUTES as readonly string[]).includes(p) ? (p as Route) : '/'
}

export function navigate(to: string) {
  if (to !== window.location.pathname) {
    window.history.pushState({}, '', to)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
  window.scrollTo(0, 0)
}

export function useRoute(): Route {
  const [path, setPath] = useState(() => window.location.pathname)
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  return normalizePath(path)
}

/** Anchor that navigates client-side but stays a real, crawlable <a href>. */
export function Link({
  to,
  className,
  children,
}: {
  to: Route
  className?: string
  children: ReactNode
}) {
  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    navigate(to)
  }
  return (
    <a href={to} className={className} onClick={onClick}>
      {children}
    </a>
  )
}
