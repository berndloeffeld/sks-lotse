import { describe, expect, it } from 'vitest'

import { isCheckoutUrl } from './checkout'

describe('isCheckoutUrl', () => {
  it('accepts Stripe’s hosted checkout', () => {
    expect(isCheckoutUrl('https://checkout.stripe.com/c/pay/cs_test_1#frag')).toBe(true)
  })

  it.each([
    ['another host', 'https://evil.example/c/pay/cs_1'],
    ['a look-alike host', 'https://checkout.stripe.com.evil.example/c/pay'],
    ['a look-alike prefix', 'https://evilcheckout.stripe.com/c/pay'],
    ['embedded credentials', 'https://checkout.stripe.com@evil.example/c/pay'],
    ['plain http', 'http://checkout.stripe.com/c/pay'],
    ['another port', 'https://checkout.stripe.com:8443/c/pay'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a relative path', '/c/pay/cs_1'],
    ['nothing', ''],
  ])('rejects %s', (_, url) => {
    expect(isCheckoutUrl(url)).toBe(false)
  })
})
