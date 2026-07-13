import Link from 'next/link'
import { Fragment, type ReactNode } from 'react'

// Content is authored by us (trusted, static), so we support a tiny, safe inline
// syntax instead of full markdown/HTML — no dangerouslySetInnerHTML, no XSS surface:
//   **bold**            -> <strong>
//   [label](/internal)  -> <Link> (internal) or <a target=_blank> (external)
const TOKEN = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g

export function renderRich(text: string): ReactNode[] {
  return text.split(TOKEN).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-gray-900">
          {part.slice(2, -2)}
        </strong>
      )
    }

    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link) {
      const [, label, href] = link
      if (href.startsWith('/')) {
        return (
          <Link
            key={i}
            href={href}
            className="font-semibold text-nurei-cta underline decoration-nurei-cta/40 underline-offset-2 transition-colors hover:text-nurei-cta-hover"
          >
            {label}
          </Link>
        )
      }
      return (
        <a
          key={i}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-nurei-cta underline underline-offset-2 hover:text-nurei-cta-hover"
        >
          {label}
        </a>
      )
    }

    return <Fragment key={i}>{part}</Fragment>
  })
}
