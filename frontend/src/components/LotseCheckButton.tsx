import type { KeyboardEvent, Ref } from 'react'
import { Link } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { HelmIcon } from './icons/FeatureIcons'

// What happens to the answer lives in the tooltip and the accessible description, not in a caption.
const SEND_NOTICE = 'KI-Prüfung: Deine Antwort wird dafür an Anthropic gesendet.'

// A diagonal corner ribbon ("KI"), clipped by the row (which needs relative + overflow-hidden).
function Ribbon() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute top-[8px] -right-[22px] w-[74px] rotate-45 bg-primary py-px text-center text-[0.7rem] leading-4 font-bold tracking-widest text-surface shadow-sm"
    >
      KI
    </span>
  )
}

interface LotseCheckButtonProps {
  // Unique per check on the page, for the accessible description.
  noticeId: string
  // Tokens one check costs (ADR-0043, ADR-0058).
  cost: number
  // What the check offers, shown while it can run: "Die KI schlägt dir … vor".
  pitch: string
  isChecking: boolean
  // Why the check can't run yet although the account could pay for it (no answer, too long, …).
  blockedHint: string | null
  onCheck: () => void
  buttonRef?: Ref<HTMLButtonElement>
  onButtonKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void
}

// "Antwort vom Lotsen bewerten lassen" (ADR-0031, ADR-0043, ADR-0044, ADR-0058): the button every
// Lotsen-Check shares, with the account's token states. Accounts that can't pay for a check see it
// dimmed — with a link to buy more where the checkout is open to them (ADR-0048), with "bald
// verfügbar" otherwise (prices live on /pricing). Guests (no login, ADR-0054) see it dimmed as a
// teaser, with a link to sign up: an account starts with tokens.
export function LotseCheckButton({
  noticeId,
  cost,
  pitch,
  isChecking,
  blockedHint,
  onCheck,
  buttonRef,
  onButtonKeyDown,
}: LotseCheckButtonProps) {
  const user = useAuthStore((s) => s.user)
  const isGuest = !useAuthStore((s) => s.isAuthenticated)
  const balance = user?.token_balance ?? 0
  const canPay = balance >= cost
  const canBuy = user?.can_buy_tokens ?? false
  const cannotPay = isGuest ? 'Mit Anmeldung, Start-Tokens geschenkt' : canBuy ? 'Keine Tokens mehr' : 'bald verfügbar'
  const price = cost === 1 ? `${balance} Token(s)` : `${cost} Tokens, du hast ${balance}`

  let hint = `${pitch} · ${price}`
  if (isChecking) hint = 'Lotse prüft…'
  else if (blockedHint) hint = blockedHint

  return (
    <>
      <span id={noticeId} className="sr-only">
        {SEND_NOTICE}
      </span>
      <button
        ref={buttonRef}
        type="button"
        disabled={!canPay || isChecking || blockedHint !== null}
        title={
          canPay
            ? SEND_NOTICE
            : isGuest
              ? 'Mit Anmeldung: KI-Prüfung deiner Antwort'
              : canBuy
                ? 'Keine Tokens mehr'
                : 'Bald verfügbar: KI-Prüfung deiner Antwort'
        }
        aria-describedby={noticeId}
        onClick={onCheck}
        onKeyDown={onButtonKeyDown}
        className="relative flex min-h-10 items-center gap-3 overflow-hidden rounded-tile border border-dashed border-accent py-1.5 pr-[72px] pl-3 text-left text-ink transition hover:bg-surface-alt disabled:opacity-60 disabled:hover:bg-transparent"
      >
        <HelmIcon className="size-6 shrink-0 text-accent" />
        <span className="flex flex-col">
          <span className="font-mono text-sm tracking-wide uppercase">Antwort vom Lotsen bewerten lassen</span>
          <span className="text-xs text-ink-soft">{canPay ? hint : cannotPay}</span>
        </span>
        <Ribbon />
      </button>
      {isGuest ? (
        <Link to="/login" className="self-start text-sm text-primary underline">
          Anmelden und den Lotsen fragen
        </Link>
      ) : null}
      {!canPay && canBuy ? (
        <Link to="/pricing" className="self-start text-sm text-primary underline">
          Tokens kaufen
        </Link>
      ) : null}
    </>
  )
}
