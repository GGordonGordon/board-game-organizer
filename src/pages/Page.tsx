import type { ReactNode } from 'react'

/** Shell for the static content pages (about / privacy / terms / contact). */
export function Page({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <article className="page panel">
      <h1>{title}</h1>
      {subtitle && <p className="page-subtitle">{subtitle}</p>}
      {children}
    </article>
  )
}
