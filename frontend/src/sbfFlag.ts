// The SBF Navigationsaufgaben flag for the SBF build, VITE_SBF (ADR-0067): "off" builds only the
// placeholder site, "on" the Navigationsaufgaben for guests. Unset is "off"; a typo fails the build
// (vite.config.ts) instead of quietly falling back, and so does setting it in the SKS build, where
// it would mean nothing. No import.meta here, since vite.config.ts imports this too.

export type SbfFlag = 'off' | 'on'

const VALUES: readonly string[] = ['off', 'on']

export function parseSbfFlag(value: string | undefined): SbfFlag {
  if (!value) return 'off'
  if (!VALUES.includes(value)) {
    throw new Error(`VITE_SBF must be one of off, on — got "${value}"`)
  }
  return value as SbfFlag
}
