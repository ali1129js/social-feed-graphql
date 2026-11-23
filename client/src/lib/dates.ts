import type { LocaleName } from "./types";

export function formatPostTime(iso: string, locale: LocaleName): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
