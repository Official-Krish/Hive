import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { env } from "../config/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const PREFIX = "v1";

// Copy into an ArrayBuffer-backed view; bun-types' node:crypto params require
// `Uint8Array<ArrayBuffer>` and reject the global ArrayBufferLike-typed Buffer.
const KEY = new Uint8Array(
  createHash("sha256").update(env.GITHUB_TOKEN_ENCRYPTION_KEY).digest(),
);

/** Encrypt a secret value, returning a versioned, self-describing string. */
export function encryptSecret(plaintext: string): string {
  const iv = new Uint8Array(randomBytes(IV_LENGTH));
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = new Uint8Array(cipher.update(plaintext, "utf8"));
  const final = new Uint8Array(cipher.final());
  const tag = new Uint8Array(cipher.getAuthTag());

  const payload = new Uint8Array(encrypted.length + final.length);
  payload.set(encrypted);
  payload.set(final, encrypted.length);

  return [PREFIX, toBase64Url(iv), toBase64Url(tag), toBase64Url(payload)].join(
    ".",
  );
}

/** Decrypt a value produced by {@link encryptSecret}. Throws on tampering. */
export function decryptSecret(payload: string): string {
  const [prefix, ivB64, tagB64, dataB64] = payload.split(".");
  if (prefix !== PREFIX || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted payload");
  }

  const decipher = createDecipheriv(ALGORITHM, KEY, fromBase64Url(ivB64));
  decipher.setAuthTag(fromBase64Url(tagB64));

  const decrypted = Buffer.concat([
    new Uint8Array(decipher.update(fromBase64Url(dataB64))),
    new Uint8Array(decipher.final()),
  ]);
  return decrypted.toString("utf8");
}

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function fromBase64Url(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64url"));
}
