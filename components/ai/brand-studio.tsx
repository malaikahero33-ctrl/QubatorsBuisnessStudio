"use client";

import { useState } from "react";
import { AiPanel, GenerateButton, type Allowance } from "@/components/ai/ai-panel";
import { generateBrandAction } from "@/lib/ai/actions";
import { Field } from "@/components/ui/field";

type BrandResponse = {
  name_options: Array<{ name: string; why: string }>;
  tagline_options: string[];
  tone_of_voice: string[];
  colors: Array<{ name: string; hex: string; use: string }>;
  fonts: { heading: string; body: string; note: string };
  brand_personality: string[];
  logo_direction: string;
  what_to_avoid: string[];
  assumptions: string[];
  warnings: string[];
};

/** Rough luminance, for deciding whether to put light or dark text on a swatch. */
function isDark(hex: string): boolean {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return false;
  const [r, g, b] = [m[1], m[2], m[3]].map((c) => parseInt(c, 16) / 255);
  // Rec. 709 luma. Good enough to keep text readable on a swatch.
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.5;
}

export function BrandStudio({ allowance }: { allowance: Allowance }) {
  const [keywords, setKeywords] = useState("");
  const [style, setStyle] = useState("");

  return (
    <AiPanel<BrandResponse>
      allowance={allowance}
      form={(run) => (
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Words to convey"
              name="keywords"
              hint="e.g. home, warm, local"
            >
              <input
                className="input"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
              />
            </Field>
            <Field label="Visual style" name="style" hint="e.g. bright, hand-drawn">
              <input
                className="input"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
              />
            </Field>
          </div>

          <div className="mt-4">
            <GenerateButton
              run={run}
              call={() => generateBrandAction({ keywords, style })}
              label="Build a brand kit"
              busyLabel="Building…"
            />
          </div>
        </div>
      )}
    >
      {(data) => (
        <div className="space-y-6">
          <section>
            <h3 className="text-sm font-bold">Names</h3>
            <ul className="mt-2 space-y-2">
              {data.name_options.map((n, i) => (
                <li key={i} className="rounded-lg bg-surface-2 px-3 py-2">
                  <p className="font-semibold">{n.name}</p>
                  <p className="text-xs text-muted">{n.why}</p>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-sm font-bold">Taglines</h3>
            <ul className="mt-2 space-y-1">
              {data.tagline_options.map((t, i) => (
                <li key={i} className="text-sm">· {t}</li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-sm font-bold">Colours</h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {data.colors.map((c, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-lg border border-border"
                >
                  <div
                    className="flex h-16 items-end justify-between p-2"
                    style={{
                      backgroundColor: c.hex,
                      color: isDark(c.hex) ? "#fff" : "#000",
                    }}
                  >
                    <span className="font-mono text-xs font-bold">{c.hex}</span>
                    <span className="text-xs">{c.name}</span>
                  </div>
                  <p className="px-3 py-2 text-xs text-muted">{c.use}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-bold">Personality</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {data.brand_personality.map((p, i) => (
                  <span key={i} className="pill pill-brand">{p}</span>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-bold">Tone of voice</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {data.tone_of_voice.map((t, i) => (
                  <span key={i} className="pill">{t}</span>
                ))}
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-bold">Fonts</h3>
            <dl className="mt-2 space-y-1 text-sm">
              <div>
                <dt className="inline font-semibold">Headings: </dt>
                <dd className="inline text-muted">{data.fonts.heading}</dd>
              </div>
              <div>
                <dt className="inline font-semibold">Body: </dt>
                <dd className="inline text-muted">{data.fonts.body}</dd>
              </div>
            </dl>
            {data.fonts.note && (
              <p className="mt-1 text-xs text-muted">{data.fonts.note}</p>
            )}
          </section>

          <section>
            <h3 className="text-sm font-bold">Logo direction</h3>
            <p className="mt-1 text-sm text-muted">{data.logo_direction}</p>
          </section>

          {data.what_to_avoid.length > 0 && (
            <section>
              <h3 className="text-sm font-bold">Avoid</h3>
              <ul className="mt-1 space-y-1">
                {data.what_to_avoid.map((w, i) => (
                  <li key={i} className="text-sm text-danger">· {w}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </AiPanel>
  );
}
