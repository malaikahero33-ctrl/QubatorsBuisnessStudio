import type { Metadata } from "next";
import "./globals.css";

/*
 * No next/font/google here on purpose.
 *
 * The default create-next-app layout imports Geist from Google Fonts, which
 * makes a build-time and runtime request to an external host. This app makes
 * zero external requests so it runs fully offline. The system font stack is
 * defined in app/globals.css under @theme inline.
 */

export const metadata: Metadata = {
  title: {
    default: "Qubators Business Studio",
    template: "%s · Qubators Business Studio",
  },
  description:
    "AI-powered business creation and growth platform. Turn your idea into a structured, branded, market-ready business.",
};

/**
 * Applied before first paint.
 *
 * Without this the page renders in the default theme, then swaps after
 * React hydrates — a visible white flash for anyone who chose dark. This
 * has to be a blocking inline script: a deferred one runs too late.
 */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("qb_theme");if(t!=="light"&&t!=="dark"){t="system"}document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","system");}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The script mutates data-theme on this element before React runs, so the
    // server-rendered and client-rendered markup legitimately differ.
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
