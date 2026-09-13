import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { env } from "../config/env";

let client: S3Client | null = null;

/** Custom endpoint, or null for direct AWS S3. Garbage values are ignored. */
function customEndpoint(): string | null {
  const raw = env.S3_ENDPOINT.trim().replace(/^=+/, "");
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return raw;
  } catch {
    return null;
  }
}

function s3(): S3Client {
  if (!env.S3_BUCKET || !env.S3_ACCESS_KEY || !env.S3_SECRET_KEY) {
    throw new Error(
      "Thumbnail uploads are not configured (S3_BUCKET/S3_ACCESS_KEY/S3_SECRET_KEY)",
    );
  }
  if (!client) {
    const endpoint = customEndpoint();
    client = new S3Client({
      region: env.S3_REGION,
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
    });
  }
  return client;
}

function publicUrl(key: string): string {
  if (env.THUMBNAIL_PUBLIC_BASE) {
    return `${env.THUMBNAIL_PUBLIC_BASE.replace(/\/$/, "")}/${key}`;
  }
  return `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com/${key}`;
}

/** Uploads bytes as-is and returns the public URL. No resizing, no re-encode. */
export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  await s3().send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      // Versioned URLs (?v=timestamp) bust caches; a day here is just a backstop.
      CacheControl: "public, max-age=86400",
    }),
  );
  return publicUrl(key);
}

/** Object key for a workspace's world thumbnail. Timestamped so every
 *  upload is a brand-new URL — no CDN or browser cache can serve a stale
 *  (e.g. black) frame for a fresh capture. */
export function thumbnailKey(
  workspaceId: string,
  ext: string,
  timestamp = Date.now(),
): string {
  return `hive/thumbnails/${workspaceId}/thumbnail-${timestamp}.${ext}`;
}

/** Best-effort delete (old covers, healthchecks). Never throws. */
export async function deleteFile(key: string): Promise<void> {
  try {
    await s3().send(
      new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
    );
  } catch {
    /* orphaned keys are harmless — S3 lifecycle can age them out */
  }
}
