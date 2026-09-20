// The SSO providers the login page knows how to draw a button for (ADR-0034); the backend decides
// which of them are actually configured.
export const SSO_PROVIDERS = ['google', 'facebook'] as const

export type SsoProvider = (typeof SSO_PROVIDERS)[number]

export function isSsoProvider(name: string): name is SsoProvider {
  return (SSO_PROVIDERS as readonly string[]).includes(name)
}
