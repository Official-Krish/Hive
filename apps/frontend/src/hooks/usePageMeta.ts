import { useEffect } from "react";

/** Sets document title + meta description for static pages (no extra deps). */
export function usePageMeta(title: string, description: string) {
  useEffect(() => {
    document.title = `${title} — Hive`;
    let tag = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    if (!tag) {
      tag = document.createElement("meta");
      tag.name = "description";
      document.head.appendChild(tag);
    }
    tag.content = description;
  }, [title, description]);
}
