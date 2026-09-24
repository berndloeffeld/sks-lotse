// Keeps the mutation-testing scope (`mutate` in stryker.config.json) in step with the code.
// A logic module missing from it is silently unchecked by Stryker (docs/mutation-testing.md),
// so a new one has to be listed there or excluded here on purpose.
import { describe, expect, it } from 'vitest'

import config from '../../stryker.config.json'

// Non-test, non-declaration .ts files at the levels where logic lives (no components/pages).
const SOURCES = import.meta.glob(['/src/*.ts', '/src/api/*.ts', '/src/store/*.ts', '/src/hooks/*.ts'])

// Deliberately not mutated (CLAUDE.md → Mutation testing).
const EXCLUDED = new Set([
  'src/api/types.ts', // types only, no runtime code
  'src/api/schema.gen.ts', // generated from the backend's OpenAPI schema, types only
])

function mutateScope(): Set<string> {
  return new Set(config.mutate)
}

function modules(): Set<string> {
  return new Set(
    Object.keys(SOURCES)
      .filter((path) => !path.endsWith('.test.ts') && !path.endsWith('.d.ts'))
      .map((path) => path.slice(1)),
  )
}

describe('mutation scope', () => {
  it('lists every logic module or excludes it on purpose', () => {
    const missing = [...modules()].filter((path) => !mutateScope().has(path) && !EXCLUDED.has(path))
    expect(
      missing,
      `${missing.join(', ')} not in "mutate" of frontend/stryker.config.json: add them there, or to EXCLUDED in ` +
        'this test with a reason. See CLAUDE.md → Mutation testing.',
    ).toEqual([])
  })

  it('lists no module that no longer exists', () => {
    const existing = modules()
    const stale = [...mutateScope()].filter((path) => !existing.has(path))
    expect(stale, `${stale.join(', ')} in "mutate" but the file is gone — remove or rename the entry.`).toEqual([])
  })

  it('keeps excluded modules real and out of the scope', () => {
    const existing = modules()
    const scope = mutateScope()
    expect([...EXCLUDED].filter((path) => !existing.has(path))).toEqual([])
    expect([...EXCLUDED].filter((path) => scope.has(path))).toEqual([])
  })
})
