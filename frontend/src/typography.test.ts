import { describe, expect, it } from 'vitest'

import { TERMS } from './labels'

// Every UI source (components, pages, text modules) as text, without tests and the catalog data.
const SOURCES = import.meta.glob(
  ['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}', '!/src/data/**', '!/src/test/**', '!/src/**/*.gen.ts'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>

const FILES = Object.keys(SOURCES)
const read = (path: string) => SOURCES[path]

// Where a rejected spelling is fine: the catalog source line (code identifiers like AccountMenu never match).
const ALLOWED: Record<string, string[]> = {
  // The legal texts keep "Musterantworten" (AGB are only typographically touched, no new version); the
  // Datenschutz "Kategorie" is the category of a question report, not a Fach.
  Musterantwort: ['LegalFooter.tsx', 'AgbPage.tsx', 'PrivacyPage.tsx'],
  Kategorie: ['PrivacyPage.tsx'],
}

function offenders(pattern: RegExp): string[] {
  return FILES.flatMap((file) =>
    read(file)
      .split('\n')
      .flatMap((line, i) => (pattern.test(line) ? [`${file.slice(1)}:${i + 1}`] : [])),
  )
}

describe('UI text rules', () => {
  it('closes German quotes with “, not a straight "', () => {
    expect(offenders(/„[^“”"\n]*"/)).toEqual([])
  })

  it('writes the loading text as "Lädt …"', () => {
    expect(offenders(/Lädt…/)).toEqual([])
  })

  it('has no "(s)" plurals', () => {
    expect(offenders(/\w\(s\)/)).toEqual([])
  })

  it('uses only the agreed terms', () => {
    const hits = TERMS.flatMap(({ rejected }) =>
      rejected.flatMap((word) => {
        const pattern = new RegExp(`(?<![A-Za-zäöüß])${word}(?:s|en)?(?![A-Za-zäöüß])`)
        return FILES.filter(
          (file) => !file.endsWith('labels.ts') && !ALLOWED[word]?.some((name) => file.endsWith(name)),
        )
          .filter((file) =>
            read(file)
              .split('\n')
              .some((line) => !/^\s*(\/\/|\*)/.test(line) && pattern.test(line)),
          )
          .map((file) => `${word}: ${file.slice(1)}`)
      }),
    )
    expect(hits).toEqual([])
  })
})
