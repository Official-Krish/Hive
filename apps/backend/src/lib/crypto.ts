import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function generateRandomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(
    new Uint8Array(aBuf.buffer, aBuf.byteOffset, aBuf.byteLength),
    new Uint8Array(bBuf.buffer, bBuf.byteOffset, bBuf.byteLength),
  );
}

export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, { algorithm: "argon2id" });
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return Bun.password.verify(password, hash);
}
