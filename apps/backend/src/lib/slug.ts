import { randomBytes } from "node:crypto";

export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "org"
  );
}

export function uniqueSlug(base: string, suffixBytes = 4): string {
  return `${slugify(base)}-${randomBytes(suffixBytes).toString("hex")}`;
}
