import { Fragment, type ReactNode } from 'react'

// The catalog writes a drying height ("2,3 m" on a Seekarte) as an underlined
// digit followed by a small one: U+0332 (combining low line) + a subscript
// digit. Fonts set that badly, so it is drawn with real markup instead.
const DRYING_HEIGHT = /(\d)̲([₀-₉])/g

/** Text with the catalog's chart notation rendered as markup. */
export function RichText({ text }: { text: string }) {
  const parts: ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(DRYING_HEIGHT)) {
    parts.push(text.slice(last, match.index))
    const decimal = String.fromCharCode(match[2].charCodeAt(0) - 0x2080 + 0x30)
    parts.push(
      <Fragment key={match.index}>
        <span className="underline decoration-2 underline-offset-4">{match[1]}</span>
        <sub className="text-[0.6em]">{decimal}</sub>
      </Fragment>,
    )
    last = match.index + match[0].length
  }
  parts.push(text.slice(last))
  return <>{parts}</>
}
