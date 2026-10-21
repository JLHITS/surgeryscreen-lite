/** Canonical blob key builders. Keep these in one place so the publish
 *  pipeline, media route and cleanup logic always agree. */

export function originalKey(practiceId: string, slideId: string, ext: string): string {
  return `originals/${practiceId}/${slideId}${ext}`;
}

export function publishedKey(
  practiceId: string,
  version: number,
  slideId: string,
): string {
  return `published/${practiceId}/v${version}/${slideId}.jpg`;
}

/** Prefix (with trailing slash) covering every blob owned by a practice. */
export function practiceOriginalsPrefix(practiceId: string): string {
  return `originals/${practiceId}/`;
}

export function practicePublishedPrefix(practiceId: string): string {
  return `published/${practiceId}/`;
}

export function publishedVersionPrefix(practiceId: string, version: number): string {
  return `published/${practiceId}/v${version}/`;
}

export function practiceLogoKey(practiceId: string, id: string, ext: string): string {
  return `logos/${practiceId}/${id}${ext}`;
}

export function practiceLogosPrefix(practiceId: string): string {
  return `logos/${practiceId}/`;
}
