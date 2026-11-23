import type { LocaleName, ThemeName } from "./types";

export interface UIStrings {
  skipToContent: string;
  title: string;
  subtitle: string;
  documentTitle: string;
  theme: string;
  language: string;
  localeEn: string;
  localeDe: string;
  themeLabel: Record<ThemeName, string>;
  animatedBackground: string;
  animatedBackgroundReduced: string;
  feedHeading: string;
  feedPlaceholder: string;
  fictionalNote: string;
}

const en: UIStrings = {
  skipToContent: "Skip to content",
  title: "Social Feed",
  subtitle: "A GraphQL feed demo with fictional people",
  documentTitle: "Social Feed",
  theme: "Colour scheme",
  language: "Language",
  localeEn: "EN",
  localeDe: "DE",
  themeLabel: { khaki: "Khaki", graphite: "Graphite", midnight: "Midnight" },
  animatedBackground: "Animated background",
  animatedBackgroundReduced: "Animated background (off, your system asks for reduced motion)",
  feedHeading: "Feed",
  feedPlaceholder: "The feed arrives with the next steps: schema, auth, then the client list.",
  fictionalNote: "All people and posts are fictional example data.",
};

const de: UIStrings = {
  skipToContent: "Zum Inhalt springen",
  title: "Social Feed",
  subtitle: "Eine GraphQL-Feed-Demo mit erfundenen Personen",
  documentTitle: "Social Feed",
  theme: "Farbschema",
  language: "Sprache",
  localeEn: "EN",
  localeDe: "DE",
  themeLabel: { khaki: "Khaki", graphite: "Graphit", midnight: "Mitternacht" },
  animatedBackground: "Animierter Hintergrund",
  animatedBackgroundReduced: "Animierter Hintergrund (aus, dein System wünscht weniger Bewegung)",
  feedHeading: "Feed",
  feedPlaceholder: "Der Feed folgt mit den nächsten Schritten: Schema, Anmeldung, dann die Liste.",
  fictionalNote: "Alle Personen und Beiträge sind erfundene Beispieldaten.",
};

export const STRINGS: Readonly<Record<LocaleName, UIStrings>> = { en, de };
