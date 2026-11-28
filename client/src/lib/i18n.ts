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
  fictionalNote: string;
  signInHeading: string;
  signInHelp: string;
  signInAction: string;
  signInAs: string;
  signingIn: string;
  signOut: string;
  signedInAs: string;
  pickUser: string;
  composerHeading: string;
  composerPlaceholder: string;
  composerPublish: string;
  composerPublishing: string;
  remainingChars: (n: number) => string;
  like: string;
  liked: string;
  likes: (n: number) => string;
  commentHeading: string;
  commentPlaceholder: string;
  commentAction: string;
  commentPosting: string;
  noComments: string;
  deletePost: string;
  deleteComment: string;
  deleting: string;
  loadingFeed: string;
  coldStartNote: string;
  feedError: string;
  retry: string;
  emptyFeed: string;
  signInToPost: string;
  signInToReact: string;
  loadMore: string;
  loadingMore: string;
  loadMoreError: string;
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
  fictionalNote: "All people and posts are fictional example data.",
  signInHeading: "Sign in",
  signInHelp: "Pick a seeded demo user. There is no password.",
  signInAction: "Sign in",
  signInAs: "Sign in as",
  signingIn: "Signing in…",
  signOut: "Sign out",
  signedInAs: "Signed in as",
  pickUser: "Choose a user",
  composerHeading: "New post",
  composerPlaceholder: "Write a post",
  composerPublish: "Publish",
  composerPublishing: "Publishing…",
  remainingChars: (n) => (n === 1 ? "1 character left" : `${n} characters left`),
  like: "Like",
  liked: "Liked",
  likes: (n) => (n === 1 ? "1 like" : `${n} likes`),
  commentHeading: "Comments",
  commentPlaceholder: "Write a comment",
  commentAction: "Comment",
  commentPosting: "Posting…",
  noComments: "No comments yet.",
  deletePost: "Delete post",
  deleteComment: "Delete comment",
  deleting: "Deleting…",
  loadingFeed: "Loading the feed…",
  coldStartNote:
    "The demo runs on free hosting. If it was idle, the first load can take 30 to 60 seconds while the server wakes up.",
  feedError: "The feed could not be loaded.",
  retry: "Try again",
  emptyFeed: "No posts yet.",
  signInToPost: "Sign in to write a post.",
  signInToReact: "Sign in to like or comment.",
  loadMore: "Load more",
  loadingMore: "Loading more…",
  loadMoreError: "The next page could not be loaded.",
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
  fictionalNote: "Alle Personen und Beiträge sind erfundene Beispieldaten.",
  signInHeading: "Anmelden",
  signInHelp: "Wähle eine vorgegebene Demo-Person. Es gibt kein Passwort.",
  signInAction: "Anmelden",
  signInAs: "Anmelden als",
  signingIn: "Anmeldung…",
  signOut: "Abmelden",
  signedInAs: "Angemeldet als",
  pickUser: "Person wählen",
  composerHeading: "Neuer Beitrag",
  composerPlaceholder: "Schreib einen Beitrag",
  composerPublish: "Veröffentlichen",
  composerPublishing: "Wird veröffentlicht…",
  remainingChars: (n) => (n === 1 ? "1 Zeichen übrig" : `${n} Zeichen übrig`),
  like: "Gefällt mir",
  liked: "Gefällt dir",
  likes: (n) => (n === 1 ? "1 Like" : `${n} Likes`),
  commentHeading: "Kommentare",
  commentPlaceholder: "Schreib einen Kommentar",
  commentAction: "Kommentieren",
  commentPosting: "Wird gesendet…",
  noComments: "Noch keine Kommentare.",
  deletePost: "Beitrag löschen",
  deleteComment: "Kommentar löschen",
  deleting: "Wird gelöscht…",
  loadingFeed: "Feed wird geladen…",
  coldStartNote:
    "Die Demo läuft auf kostenlosem Hosting. Nach einer Pause kann der erste Aufruf 30 bis 60 Sekunden dauern, bis der Server aufgewacht ist.",
  feedError: "Der Feed konnte nicht geladen werden.",
  retry: "Nochmal versuchen",
  emptyFeed: "Noch keine Beiträge.",
  signInToPost: "Melde dich an, um einen Beitrag zu schreiben.",
  signInToReact: "Melde dich an, um zu liken oder zu kommentieren.",
  loadMore: "Mehr laden",
  loadingMore: "Weitere Beiträge werden geladen…",
  loadMoreError: "Die nächste Seite konnte nicht geladen werden.",
};

export const STRINGS: Readonly<Record<LocaleName, UIStrings>> = { en, de };
