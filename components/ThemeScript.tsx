import { DEFAULT_THEME, THEME_STORAGE_KEY } from "@/lib/theme";

/**
 * Sets data-theme on <html> before first paint.
 *
 * Has to be a blocking inline script: React cannot run early enough, and
 * resolving the theme after hydration would show a flash of the wrong
 * palette. It is ~200 bytes and runs synchronously in <head>.
 *
 * With DEFAULT_THEME = "dark" this is a no-op in practice — :root already
 * carries the dark palette, so nothing shifts. It exists so that flipping
 * the switch in lib/theme.ts, or adding a toggle button, needs no further
 * plumbing.
 */
export default function ThemeScript() {
  const js = `(function(){try{var d=${JSON.stringify(DEFAULT_THEME)};var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var t=s||(d==="system"?(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):d);document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
