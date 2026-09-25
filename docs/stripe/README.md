# Stripe products

The product entries as set up in the Stripe dashboard. Prices are not listed here: they're operator-tunable (`/admin/settings`, ADR-0043), and the code defaults are in `backend/app/core/pricing.py`. The images are rendered by [generate_images.py](generate_images.py). They show the token amount, so re-run the script and re-upload the image when a package's amount changes.

| Image | Name | Description |
|---|---|---|
| [werbefrei.png](werbefrei.png) | SKS Lotse – Werbefrei | Einmalige Zahlung: SKS Lotse dauerhaft ohne Werbeeinblendungen nutzen. |
| [tokens_s.png](tokens_s.png) | SKS Lotse – 20 Tokens (Paket S) | 20 Tokens für den Lotsen-Check. Ein Token bringt dir einen KI-Bewertungsvorschlag für eine Antwort. Die Note legst du selbst fest. |
| [tokens_m.png](tokens_m.png) | SKS Lotse – 50 Tokens (Paket M) | 50 Tokens für den Lotsen-Check. Ein Token bringt dir einen KI-Bewertungsvorschlag für eine Antwort. Die Note legst du selbst fest. |
| [tokens_l.png](tokens_l.png) | SKS Lotse – 100 Tokens (Paket L) | 100 Tokens für den Lotsen-Check. Ein Token bringt dir einen KI-Bewertungsvorschlag für eine Antwort. Die Note legst du selbst fest. |
| [tokens_xl.png](tokens_xl.png) | SKS Lotse – 200 Tokens (Paket XL) | 200 Tokens für den Lotsen-Check. Ein Token bringt dir einen KI-Bewertungsvorschlag für eine Antwort. Die Note legst du selbst fest. |

All five are one-time payments (not recurring).

- **Statement descriptor:** `SKS-LOTSE.DE`, short descriptor `SKSLOTSE`
- **Tax category:** Software as a Service (SaaS) – personal use (`txcd_10103000`). It's a web app, nothing is downloaded.

## Integration

Token packages are bought through Stripe Hosted Checkout ([ADR-0048](../adr/0048-stripe-hosted-checkout-with-webhook-fulfilment.md)); code in `backend/app/services/payments.py`. The price is sent inline (`price_data`) from `/admin/settings`, so the dashboard's product only carries name, description and image.

### Configured Checkout parameters

| Parameter | Value |
|---|---|
| `ui_mode` | `hosted_page` (the value stripe-python 15.x accepts) |
| `mode` | `payment` (so no `payment_method_collection`) |
| `billing_address_collection` | `auto` |
| `phone_number_collection` | disabled |
| `automatic_tax` | disabled — the product's tax code has no effect while it is off |
| `allow_promotion_codes` | `false` |
| `submit_type` | `auto` |
| `integration_identifier` | `hosted_web_0001` |
| `origin_context` | `web` |
| `line_items` | one `price_data` item, EUR, product id from env, `unit_amount` from `app_settings` |
| `client_reference_id`, `customer_email` | user id, user email |
| `metadata` | `user_id`, `product`, `tokens` (fixed at creation), `withdrawal_waiver` |
| `success_url` / `cancel_url` | `<first CORS origin>/pricing?checkout=success` / `=cancelled` |

### Setup

Env vars (backend; `render.yaml` declares them `sync: false`): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRODUCT_TOKENS_S|M|L|XL` (the `prod_…` ids above, different per mode) and the flag `STRIPE_CHECKOUT` = `off` | `admins` | `on`. Webhook endpoint and flag handling: [runbook](../RUNBOOK.md#stripe-checkout).

### Testing locally

Test-mode keys and product ids in `backend/.env`, `STRIPE_CHECKOUT=admins`, your address in `ADMIN_EMAILS`, then:

```bash
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded --forward-to localhost:8000/api/v1/payments/webhook
```

It prints the `whsec_…` for `STRIPE_WEBHOOK_SECRET`. Buy Paket S on `/pricing`. Test cards: `4242 4242 4242 4242` (works), `4000 0025 0000 3155` (3-D Secure). `stripe events resend <evt_…>` must not credit twice.

### Links

- [support.stripe.com](https://support.stripe.com)
- [docs.stripe.com/mcp](https://docs.stripe.com/mcp)
