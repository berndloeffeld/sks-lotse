import { useCheckLimits } from '../hooks/useCheckLimits'
import type { FormTone } from './formStyles'
import { HelmIcon } from './icons/FeatureIcons'

const BOX_TONES: Record<FormTone, string> = {
  light: 'border-primary bg-surface text-primary',
  dark: 'border-surface text-surface',
}

interface SignupBonusNoteProps {
  // `box` above the login form's email field, `line` under the landing page's hero button.
  variant: 'box' | 'line'
  tone?: FormTone
}

// Before the login: an account starts with the signup bonus (ADR-0043), so say so where a guest
// signs up. The number comes from GET /pricing; until it has answered (the prerendered landing
// page) the note says the same without it, and with a bonus of 0 there is nothing to say.
export function SignupBonusNote({ variant, tone = 'light' }: SignupBonusNoteProps) {
  const { signupBonusTokens } = useCheckLimits()
  if (signupBonusTokens === 0) return null

  const tokens = signupBonusTokens === null ? 'Tokens' : `${signupBonusTokens} Tokens`
  const icon = <HelmIcon className="size-5 shrink-0" />

  if (variant === 'line') {
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

  return (
    <p className={`flex items-start gap-2 rounded-tile border-2 px-3 py-2 text-sm ${BOX_TONES[tone]}`}>
      {icon}
      <span>
        Jetzt anmelden und <strong>{tokens}</strong> für KI-gestützte Auswertungen deiner Antworten geschenkt bekommen.
      </span>
    </p>
  )
}
