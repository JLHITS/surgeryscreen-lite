/** Slug helpers for practice URLs (e.g. /ExampleSurgery). */

export const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "_next",
  "static",
  "public",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "login",
  "logout",
]);

/** Suggest a URL slug from a practice name (drops spaces & punctuation). */
export function suggestSlug(name: string): string {
  // NFKD splits accented letters into base + combining mark; the character
  // filter below then drops the marks, leaving the plain ASCII letter.
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "");
  return cleaned || "Display";
}

export function isValidSlug(slug: string): boolean {
  return (
    /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(slug) &&
    !RESERVED_SLUGS.has(slug.toLowerCase())
  );
}
