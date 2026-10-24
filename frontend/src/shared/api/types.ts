// The API's shapes both sites use, generated from the backend's OpenAPI schema into schema.gen.ts by
// scripts/generate_postman_collection.sh (ADR-0046) — never edit that file by hand. Each site's own
// shapes live with the site (src/sks/api/types.ts).
import type { components } from './schema.gen'

type Schemas = components['schemas']

export type User = Schemas['UserRead']
export type PublicPricing = Schemas['PublicPricing']
export type PublicTokenPackage = Schemas['PublicTokenPackage']
export type CheckoutRead = Schemas['CheckoutRead']
