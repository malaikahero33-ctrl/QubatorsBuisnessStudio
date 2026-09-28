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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
