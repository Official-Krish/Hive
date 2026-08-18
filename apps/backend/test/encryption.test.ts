import { describe, expect, test } from "bun:test";
import { decryptSecret, encryptSecret } from "../src/lib/encryption";

describe("secret encryption", () => {
  test("round-trips a value", () => {
    const value = "gho_secret_access_token";
    const encrypted = encryptSecret(value);
    expect(encrypted).not.toContain(value);
    expect(decryptSecret(encrypted)).toBe(value);
  });

  test("produces unique ciphertext per call (random IV)", () => {
    const first = encryptSecret("same-value");
    const second = encryptSecret("same-value");
    expect(first).not.toBe(second);
    expect(decryptSecret(first)).toBe(decryptSecret(second));
  });

  test("throws on a tampered payload", () => {
    const encrypted = encryptSecret("secret");
    const [prefix, iv, tag, data] = encrypted.split(".");
    const tampered = [prefix, iv, tag, `${data!.slice(0, -2)}xx`].join(".");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  test("throws on a malformed payload", () => {
    expect(() => decryptSecret("garbage")).toThrow();
  });
});
