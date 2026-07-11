/**
 * capSlug per DM-6: lowercase, non-alphanumerics collapsed to single hyphens.
 */
export function capSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * An explicit trailing currency amount. Detect this before punctuation is
 * replaced so a product/model suffix such as "Pixel 9" is not mistaken for a
 * price. Symbols and ISO currency codes cover the forms used by pasted product
 * listings while deliberately leaving a bare trailing number untouched.
 */
const TRAILING_CURRENCY_PRICE =
  /\s*(?:[—–-]\s*)?(?:(?:(?:a|au|us|nz|c|ca)?\$|[£€¥])\s*\d[\d,]*(?:\.\d{1,2})?|(?:aud|usd|nzd|cad|gbp|eur|jpy)\s*\d[\d,]*(?:\.\d{1,2})?|\d[\d,]*(?:\.\d{1,2})?\s*(?:aud|usd|nzd|cad|gbp|eur|jpy))\s*$/i;

/**
 * Cache key normalization per API-3: strip an explicit trailing currency price
 * token, then lowercase → non-alphanumerics to spaces → collapse whitespace.
 * Price detection happens first because the normalization step erases the
 * currency marker that distinguishes "$129" from a model number such as "9".
 */
export function norm(text: string): string {
  return text
    .replace(TRAILING_CURRENCY_PRICE, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
