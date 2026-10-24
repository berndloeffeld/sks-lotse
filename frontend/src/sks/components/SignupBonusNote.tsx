import { useCheckLimits } from '../../shared/hooks/useCheckLimits'
import { HelmIcon } from './icons/FeatureIcons'

// Under the landing page's hero button: a new account starts with the signup bonus (ADR-0043).
// Only there, not in the login form, which returning learners use too. The number comes from
// GET /pricing; until it has answered (the prerendered landing page) the note says the same
// without it, and with a bonus of 0 there is nothing to say.
export function SignupBonusNote() {
  const { signupBonusTokens } = useCheckLimits()
  if (signupBonusTokens === 0) return null

  const tokens = signupBonusTokens === null ? 'Tokens' : `${signupBonusTokens} Tokens`

  // The wheel inline, in front of the first word: centred text wraps on a phone, and a flex row
  // would leave the icon stranded at the left edge.
  return (
    <p className="mt-5 text-sm text-surface">
      <HelmIcon className="mr-1.5 inline size-5 align-text-bottom" />
      <span>
        Mit Anmeldung <strong>{tokens}</strong> für KI-gestützte Auswertungen geschenkt
      </span>
    </p>
  )
}
