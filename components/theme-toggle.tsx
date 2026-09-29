"use client";

/**
 * Theme switch: light, dark, or follow the system.
 *
 * Three states rather than two, because "follow the system" is what most
 * people actually want and forcing them to pick a side each time they move
 * between a laptop and a phone is annoying.
 *
 * The value lives on <html data-theme>. CSS has two rules:
 *   :root[data-theme="dark"]     explicit dark
 *   :root:not([data-theme="light"])  system is dark
 * so exactly one applies at a time and an explicit choice always wins.
 */

import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "qb_theme";
const ORDER: Theme[] = ["light", "dark", "system"];

const LABEL: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

/** Must match the inline script in app/layout.tsx exactly. */
function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    // Private browsing can block storage. System is a safe default.
  }
  return "system";
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setTheme(readStoredTheme());
    setReady(true);
  }, []);

  const apply = (next: Theme) => {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage blocked: the theme still applies for this page view.
    }
  };

  const cycle = () => {
    const index = ORDER.indexOf(theme);
    apply(ORDER[(index + 1) % ORDER.length]);
  };

  const glyph = theme === "light" ? "☀" : theme === "dark" ? "☾" : "◐";

  return (
    <button
      type="button"
      onClick={cycle}
      className={`btn btn-sm ${className}`}
      title={`Theme: ${LABEL[theme]}. Click to change.`}
      aria-label={`Theme: ${LABEL[theme]}. Click to change.`}
      // Before the effect runs there is no stored value to show, so the
      // glyph is suppressed rather than flashing the wrong icon.
      suppressHydrationWarning
    >
      <span aria-hidden="true">{ready ? glyph : "·"}</span>
      <span className="hidden sm:inline">{ready ? LABEL[theme] : "Theme"}</span>
    </button>
  );
}
