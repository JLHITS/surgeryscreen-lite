import sharp from "sharp";
import { getBlobStore } from "@/lib/blob";
import { publishedKey, publishedVersionPrefix } from "@/lib/keys";
import { getPracticeWithSlides, pruneVersionRows, setPublished } from "@/lib/db/repo";
import {
  ASPECT_DIMENSIONS,
  type PublishedSnapshot,
  type PublishedSlide,
} from "@/lib/types";

export class PublishError extends Error {}

/** How many published versions (snapshots + image blobs) to retain. */
export const VERSION_RETENTION = 20;

/** Drop version folders/rows beyond the retention window. */
async function pruneOldVersions(practiceId: string, currentVersion: number): Promise<void> {
  const cutoff = currentVersion - VERSION_RETENTION;
  if (cutoff < 1) return;
  await getBlobStore()
    .deletePrefix(publishedVersionPrefix(practiceId, cutoff))
    .catch(() => {});
  await pruneVersionRows(practiceId, cutoff);
}

/**
 * Render the current draft into an immutable published snapshot.
 *
 * Image slides are composited onto a fixed television-resolution canvas
 * (matching the chosen aspect ratio) and encoded as optimised JPEGs. Text
 * slides carry their styling in the snapshot and are rendered live by the
 * display (crisp at any resolution); video slides carry their link. Schedule windows and widgets travel in the
 * snapshot too, so the display can apply them over time without republishing.
 */
export async function publishPractice(slug: string): Promise<PublishedSnapshot> {
  const practice = await getPracticeWithSlides(slug);
  if (!practice) throw new PublishError("Practice not found");
  if (practice.slides.length === 0) {
    throw new PublishError("Add at least one slide before publishing.");
  }

  const blob = getBlobStore();
  const { settings } = practice;
  const { w, h } = ASPECT_DIMENSIONS[settings.aspectRatio];
  const version = practice.publishedVersion + 1;

  const published: PublishedSlide[] = [];
  for (const slide of practice.slides) {
    if (slide.kind === "text") {
      published.push({
        id: slide.id,
        kind: "text",
        url: null,
        text: slide.text,
        durationMs: slide.durationMs ?? settings.defaultDurationMs,
        caption: null,
        startAt: slide.startAt,
        endAt: slide.endAt,
        repeat: slide.repeat,
      });
      continue;
    }

    if (slide.kind === "video") {
      if (!slide.video?.url) {
        throw new PublishError("One of the video slides has no video link.");
      }
      published.push({
        id: slide.id,
        kind: "video",
        url: null,
        text: null,
        video: slide.video,
        // 0 = play once through, then advance (no fixed time on screen).
        durationMs: slide.durationMs ?? 0,
        caption: null,
        startAt: slide.startAt,
        endAt: slide.endAt,
        repeat: slide.repeat,
      });
      continue;
    }

    const original = await blob.getObject(slide.originalKey);
    if (!original) {
      throw new PublishError(
        `Could not read the image for one of the slides. Try re-uploading it.`,
      );
    }

    const fit = slide.fit ?? settings.fit;
    const rendered = await sharp(original.body, { failOn: "none" })
      .rotate() // honour EXIF orientation
      .resize(w, h, {
        fit,
        position: "centre",
        background: settings.backgroundColor,
      })
      .flatten({ background: settings.backgroundColor })
      .jpeg({ quality: 82, progressive: true, mozjpeg: true })
      .toBuffer();

    const key = publishedKey(practice.id, version, slide.id);
    await blob.put(key, rendered, "image/jpeg");

    published.push({
      id: slide.id,
      kind: "image",
      url: `/api/media/${key}`,
      text: null,
      durationMs: slide.durationMs ?? settings.defaultDurationMs,
      caption: slide.caption,
      startAt: slide.startAt,
      endAt: slide.endAt,
      repeat: slide.repeat,
    });
  }

  const snapshot: PublishedSnapshot = {
    slug: practice.slug,
    name: practice.name,
    version,
    publishedAt: new Date().toISOString(),
    width: w,
    height: h,
    transition: settings.transition,
    transitionMs: settings.transitionMs,
    backgroundColor: settings.backgroundColor,
    shuffle: settings.shuffle,
    loop: settings.loop,
    showClock: settings.showClock,
    widgets: settings.widgets,
    progressTimer: settings.progressTimer,
    practiceLogoUrl: settings.logoKey ? `/api/media/${settings.logoKey}` : null,
    slides: published,
  };

  await setPublished(practice.id, snapshot);
  await pruneOldVersions(practice.id, version);

  return snapshot;
}
