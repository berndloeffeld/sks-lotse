// Stripe's hosted payment page (ADR-0048). The purchase panel sends the learner wherever the API's
// answer says; as a second line of defence it only goes to this origin, so a manipulated or
// mistaken response can't turn the "Kaufen" button into a redirect to somewhere else.
const CHECKOUT_ORIGIN = 'https://checkout.stripe.com'

export function isCheckoutUrl(url: string): boolean {
  try {
    return new URL(url).origin === CHECKOUT_ORIGIN
  } catch {
    return false
  }
}
