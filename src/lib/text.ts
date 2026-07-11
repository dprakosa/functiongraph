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
 * Cache key normalization per API-3: lowercase → non-alphanumerics to spaces →
 * collapse whitespace → strip a trailing price token. After the collapse step a
 * price like "$129.99" survives as trailing digit groups ("129 99"), so the
 * strip removes all trailing all-digit tokens.
 */
export function norm(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/( \d+)+$/, "")
    .trim();
}
