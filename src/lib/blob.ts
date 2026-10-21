import fs from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

/**
 * Blob (image) storage abstraction. Two interchangeable backends selected by
 * STORAGE_DRIVER: `local` (filesystem under DATA_DIR/blobs) and `s3` (any
 * S3-compatible bucket: AWS S3, Cloudflare R2, MinIO, Backblaze B2, ...).
 *
 * Keys are stable paths, e.g.
 *   originals/{practiceId}/{slideId}.{ext}
 *   published/{practiceId}/v{version}/{slideId}.jpg
 */
export interface BlobStore {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  /** Delete every object under a key prefix (used when removing a practice). */
  deletePrefix(prefix: string): Promise<void>;
  /** A directly servable URL if the backend supports it (public/CDN), else null. */
  directUrl(key: string): string | null;
  /** Read an object so our media route can stream it. */
  getObject(key: string): Promise<{ body: Buffer; contentType: string } | null>;
}

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
};

export function contentTypeForKey(key: string): string {
  return CONTENT_TYPES[path.extname(key).toLowerCase()] ?? "application/octet-stream";
}

export function extForContentType(contentType: string): string {
  const found = Object.entries(CONTENT_TYPES).find(([, v]) => v === contentType);
  return found ? found[0] : "";
}

// ---------------------------------------------------------------------------
// Local filesystem
// ---------------------------------------------------------------------------

class LocalBlobStore implements BlobStore {
  private base = path.join(path.resolve(env.dataDir), "blobs");

  private full(key: string) {
    return path.join(this.base, key);
  }

  async put(key: string, data: Buffer): Promise<void> {
    const file = this.full(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, data);
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.full(key), { force: true });
  }

  async deletePrefix(prefix: string): Promise<void> {
    await fs.rm(this.full(prefix), { recursive: true, force: true });
  }

  directUrl(): string | null {
    return null; // streamed through /api/media
  }

  async getObject(key: string) {
    try {
      const body = await fs.readFile(this.full(key));
      return { body, contentType: contentTypeForKey(key) };
    } catch {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// S3-compatible
// ---------------------------------------------------------------------------

class S3BlobStore implements BlobStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sdk: any;

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    this.sdk = require("@aws-sdk/client-s3");
    if (!env.s3.bucket) {
      throw new Error("S3_BUCKET is required when STORAGE_DRIVER=s3.");
    }
    this.client = new this.sdk.S3Client({
      region: env.s3.region,
      endpoint: env.s3.endpoint || undefined,
      forcePathStyle: env.s3.forcePathStyle,
      credentials:
        env.s3.accessKeyId && env.s3.secretAccessKey
          ? {
              accessKeyId: env.s3.accessKeyId,
              secretAccessKey: env.s3.secretAccessKey,
            }
          : undefined,
    });
  }

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new this.sdk.PutObjectCommand({
        Bucket: env.s3.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new this.sdk.DeleteObjectCommand({ Bucket: env.s3.bucket, Key: key }),
    );
  }

  async deletePrefix(prefix: string): Promise<void> {
    let token: string | undefined;
    do {
      const list = await this.client.send(
        new this.sdk.ListObjectsV2Command({
          Bucket: env.s3.bucket,
          Prefix: prefix,
          ContinuationToken: token,
        }),
      );
      const objects = (list.Contents ?? []).map((o: { Key: string }) => ({ Key: o.Key }));
      if (objects.length > 0) {
        await this.client.send(
          new this.sdk.DeleteObjectsCommand({
            Bucket: env.s3.bucket,
            Delete: { Objects: objects },
          }),
        );
      }
      token = list.IsTruncated ? list.NextContinuationToken : undefined;
    } while (token);
  }

  directUrl(key: string): string | null {
    return env.s3.publicUrl ? `${env.s3.publicUrl}/${key}` : null;
  }

  async getObject(key: string) {
    try {
      const res = await this.client.send(
        new this.sdk.GetObjectCommand({ Bucket: env.s3.bucket, Key: key }),
      );
      const bytes = await res.Body.transformToByteArray();
      return {
        body: Buffer.from(bytes),
        contentType: res.ContentType || contentTypeForKey(key),
      };
    } catch {
      return null;
    }
  }
}

let store: BlobStore | null = null;

/** Get the process-wide blob store for the configured storage driver. */
export function getBlobStore(): BlobStore {
  if (store) return store;
  store = env.storageDriver === "s3" ? new S3BlobStore() : new LocalBlobStore();
  return store;
}
