// A guest data export (the catalog, the Kartenaufgaben) that is loaded once, as its own chunk, and
// then kept: `snapshot()` has it at once when the prerender or main.tsx primed it before the first
// render, `load()` fetches it otherwise (concurrent callers share one request, a failed one may be
// retried). `fromRaw` turns the module's JSON into what the pages use.
export interface LazyExport<T, Raw> {
  prime: (raw: Raw) => T
  snapshot: () => T | null
  load: (importRaw?: () => Promise<Raw>) => Promise<T>
  // Tests only: forget what was loaded.
  reset: () => void
}

export function createLazyExport<T, Raw>(
  defaultImport: () => Promise<Raw>,
  fromRaw: (raw: Raw) => T,
): LazyExport<T, Raw> {
  let snapshot: T | null = null
  let pending: Promise<T> | null = null

  function prime(raw: Raw): T {
    snapshot = fromRaw(raw)
    return snapshot
  }

  return {
    prime,
    snapshot: () => snapshot,
    load(importRaw = defaultImport) {
      if (snapshot) return Promise.resolve(snapshot)
      pending ??= importRaw().then(prime, (error: unknown) => {
        pending = null
        throw error
      })
      return pending
    },
    reset() {
      snapshot = null
      pending = null
    },
  }
}
