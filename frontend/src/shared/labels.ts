// Display labels both sites show for fixed keys of the account and the token purchase.

// Mirrors GENDERS in backend/app/schemas/auth.py. Blank/"keine Angabe" is
// null on the User, not a key here.
export const GENDER_LABELS: Record<string, string> = {
  maennlich: 'Männlich',
  weiblich: 'Weiblich',
  divers: 'Divers',
}

// Mirrors PACKAGE_PRODUCTS in backend/app/domain/pricing.py (ADR-0043).
export const PACKAGE_PRODUCTS = ['tokens_s', 'tokens_m', 'tokens_l', 'tokens_xl'] as const
export type PackageProduct = (typeof PACKAGE_PRODUCTS)[number]
export const PACKAGE_LABELS: Record<PackageProduct, string> = {
  tokens_s: 'Paket S',
  tokens_m: 'Paket M',
  tokens_l: 'Paket L',
  tokens_xl: 'Paket XL',
}
