import sharp from "sharp";
import { nanoid } from "nanoid";
import { addSlide } from "@/lib/db/repo";
import { getBlobStore } from "@/lib/blob";
import { originalKey } from "@/lib/keys";
import type { DraftSlide } from "@/lib/types";

/**
 * Store an image buffer as a new draft slide for a practice: read its
 * dimensions, write the original to blob storage and create the slide row.
 * Used by the upload route.
 */
export async function ingestImageAsSlide(input: {
  practiceId: string;
  buffer: Buffer;
  contentType: string;
  ext: string;
}): Promise<DraftSlide> {
  const meta = await sharp(input.buffer).metadata();
  const id = nanoid();
  const key = originalKey(input.practiceId, id, input.ext);
  await getBlobStore().put(key, input.buffer, input.contentType);
  return addSlide({
    id,
    practiceId: input.practiceId,
    originalKey: key,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
  });
}
