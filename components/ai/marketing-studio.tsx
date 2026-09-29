"use client";

import { useState } from "react";
import { AiPanel, GenerateButton, type Allowance } from "@/components/ai/ai-panel";
import { generateMarketingAction } from "@/lib/ai/actions";
import { Field } from "@/components/ui/field";

type MarketingResponse = {
  content: string;
  channel: string;
  assumptions: string[];
  warnings: string[];
};

const CHANNELS = [
  { value: "whatsapp", label: "WhatsApp message" },
  { value: "sms", label: "SMS" },
  { value: "social_post", label: "Social media post" },
  { value: "product_description", label: "Product description" },
  { value: "poster_caption", label: "Poster or flyer caption" },
  { value: "email", label: "Email" },
] as const;

export function MarketingStudio({ allowance }: { allowance: Allowance }) {
  const [channel, setChannel] = useState<string>("whatsapp");
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [tone, setTone] = useState("");
  const [copied, setCopied] = useState(false);

  const label = CHANNELS.find((c) => c.value === channel)?.label ?? channel;

  return (
    <AiPanel<MarketingResponse>
      allowance={allowance}
      form={(run) => (
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="What is it for" name="subject" hint="A short description.">
              <input
                className="input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
                placeholder="e.g. Saturday market stall"
              />
            </Field>

            <Field label="Kind of message" name="channel">
              <select
                className="select"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
              >
                {CHANNELS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Details" name="details" hint="Price, date, offer, location.">
              <input
                className="input"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={300}
              />
            </Field>

            <Field label="Tone" name="tone" hint="Optional.">
              <input
                className="input"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                maxLength={100}
                placeholder="e.g. friendly, not formal"
              />
            </Field>
          </div>

          <div className="mt-4">
            <GenerateButton
              run={run}
              call={() =>
                generateMarketingAction({
                  channel: channel as (typeof CHANNELS)[number]["value"],
                  subject,
                  details,
                  tone,
                })
              }
              label="Write it"
              busyLabel="Writing…"
              disabled={subject.trim().length === 0}
            />
          </div>
        </div>
      )}
    >
      {(data) => (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-muted">{label}</p>
            <button
              type="button"
              className="btn btn-sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(data.content);
                  setCopied(true);
                  // Reset after a moment so the label is not a permanent lie
                  // if the clipboard write silently failed.
                  setTimeout(() => setCopied(false), 2500);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          {/* Rendered as pre-wrap rather than in a <textarea>: it is output to
              read, not to edit. The copy button is the edit path. */}
          <p className="whitespace-pre-wrap rounded-lg bg-surface-2 p-4 font-mono text-sm leading-relaxed">
            {data.content}
          </p>

          <p className="mt-2 text-xs text-muted">
            {data.content.length} characters.
            {channel === "sms" && data.content.length > 160 && (
              <span className="ml-1 font-bold text-danger">
                Over 160 — this will cost two SMS segments.
              </span>
            )}
          </p>
        </div>
      )}
    </AiPanel>
  );
}
