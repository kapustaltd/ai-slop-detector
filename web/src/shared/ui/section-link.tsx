import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'

interface SectionLinkProps {
  target: string
  className?: string
  children: ReactNode
}

/** Keep the current hash-router route when linking to a section on this page. */
export function SectionLink({ target, className, children }: SectionLinkProps) {
  const { pathname, search } = useLocation()

  return (
    <Link
      to={{ pathname, search, hash: `#${target}` }}
      className={className}
      onClick={() => document.getElementById(target)?.scrollIntoView()}
    >
      {children}
    </Link>
  )
}
