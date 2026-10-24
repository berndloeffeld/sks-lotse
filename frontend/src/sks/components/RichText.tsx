import { Fragment, type ReactNode } from 'react'

// The catalog writes a drying height ("2,3 m" on a Seekarte) as an underlined
// digit followed by a small one: U+0332 (combining low line) + a subscript
// digit. Fonts set that badly, so it is drawn with real markup instead.
// A subscript letter ("O_k", "O_b" — Unicode has no subscript b) is written
// as "_" plus the index and drawn as <sub> too.
const NOTATION = /(\d)̲([₀-₉])|([A-Za-z])_([a-z0-9])(?![A-Za-z0-9])/g

const SUB_CLASS = 'text-[0.6em]'

/** Text with the catalog's chart notation rendered as markup. */
export function RichText({ text }: { text: string }) {
  const parts: ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(NOTATION)) {
    parts.push(text.slice(last, match.index))
    if (match[1] !== undefined) {
      const decimal = String.fromCharCode(match[2].charCodeAt(0) - 0x2080 + 0x30)
      parts.push(
        <Fragment key={match.index}>
          <span className="underline decoration-2 underline-offset-4">{match[1]}</span>
          <sub className={SUB_CLASS}>{decimal}</sub>
        </Fragment>,
      )
    } else {
      parts.push(
        <Fragment key={match.index}>
          {match[3]}
          <sub className={SUB_CLASS}>{match[4]}</sub>
        </Fragment>,
      )
    }
    last = match.index + match[0].length
  }
  parts.push(text.slice(last))
  return <>{parts}</>
}
