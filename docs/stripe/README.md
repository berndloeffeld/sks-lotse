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
