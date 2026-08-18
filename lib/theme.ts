/**
 * Browser-chrome colours.
 *
 * The site's real palette lives in ONE place: Layer 1 of `app/globals.css`.
 * Everything visual derives from there and needs no help from TypeScript.
 *
 * These four values are the exception. `themeColor` (the mobile address-bar
 * tint) and the PWA manifest are emitted as HTML metadata before any CSS is
 * parsed, so they cannot read a custom property. They are duplicated here on
 * purpose.
 *
 * When you change --c-base or --c-surface in globals.css, change these to
 * match. They are the only two values in the codebase that need syncing.
 */
export const THEME = {
  /** matches --c-base in :root (dark) */
  dark: "#120405",
  /** matches --c-base in [data-theme="light"] */
  light: "#faf7f2",
  /** PWA splash background — matches --c-void (dark) */
  splash: "#0a0203",
} as const;

/**
 * THE THEME SWITCH.
 *
 *   "dark"    every visitor gets the dark palette (current brand position)
 *   "light"   every visitor gets the light palette
 *   "system"  follow the visitor's OS setting
 *
 * A stored choice in localStorage("theme") always wins over this, so a
 * toggle button can be added later without touching anything else.
 */
export const DEFAULT_THEME: ThemeChoice = "dark";

export type ThemeChoice = "dark" | "light" | "system";

/** localStorage key a future toggle button should read and write. */
export const THEME_STORAGE_KEY = "theme";
