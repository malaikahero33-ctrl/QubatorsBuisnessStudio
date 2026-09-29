"use client";

import { useState } from "react";
import { AiPanel, GenerateButton, type Allowance } from "@/components/ai/ai-panel";
import { generateIdeasAction } from "@/lib/ai/actions";
import type { CurrencyCode } from "@/lib/money";
import { Field } from "@/components/ui/field";

type Idea = {
  name: string;
  one_liner: string;
  problem_it_solves: string;
  who_pays: string;
  startup_cost_ugx: number;
  monthly_operating_cost_ugx: number;
  realistic_monthly_revenue_ugx: number;
  first_steps: string[];
  main_risk: string;
  why_now: string;
};

type IdeaResponse = {
  ideas: Idea[];
  assumptions: string[];
  warnings: string[];
};

/**
 * Idea generator.
 *
 * The figures come back as whole units, not minor units, because a model
 * asked for "startup_cost_ugx: number" means 1200000 and not 12000. Sending
 * it through toMinorUnits here would be wrong by a factor of a million, so
 * the display path uses the currency's exponent directly.
 */
export function IdeaGenerator({
  allowance,
  currency,
}: {
  allowance: Allowance;
  currency: CurrencyCode;
}) {
  const [sector, setSector] = useState("");
  const [budget, setBudget] = useState("");
  const [skills, setSkills] = useState("");

  return (
    <AiPanel<IdeaResponse>
      allowance={allowance}
      form={(run) => (
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-sm font-bold">What kind of idea?</h2>
          <p className="mt-1 text-xs text-muted">
            Every field is optional. The more you say, the less the AI has to
            guess — and the more useful the assumptions it has to declare.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label="Sector" name="sector" hint="Food, tailoring, tutoring…">
              <input
                className="input"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                placeholder="Anything"
              />
            </Field>
            <Field label="Budget" name="budget" hint="What you can actually start with.">
              <input
                className="input"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="e.g. 5,000,000 UGX"
              />
            </Field>
            <Field label="Your skills" name="skills" hint="What you know already.">
              <input
                className="input"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="e.g. accounting, tailoring"
              />
            </Field>
          </div>

          <div className="mt-4">
            <GenerateButton
              run={run}
              call={() => generateIdeasAction({ sector, budget, skills })}
              label="Generate ideas"
              busyLabel="Generating…"
            />
          </div>
        </div>
      )}
    >
      {(data) => (
        <div className="space-y-5">
          <h2 className="text-sm font-bold">{data.ideas.length} ideas</h2>

          {data.ideas.map((idea, i) => (
            <article key={i} className="rounded-xl border border-border bg-surface-2 p-4">
              <h3 className="text-base font-bold">{idea.name}</h3>
              <p className="mt-1 text-sm text-muted">{idea.one_liner}</p>

              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="font-semibold">The problem</dt>
                  <dd className="text-muted">{idea.problem_it_solves}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Who pays</dt>
                  <dd className="text-muted">{idea.who_pays}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Why now</dt>
                  <dd className="text-muted">{idea.why_now}</dd>
                </div>
              </dl>

              <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3 text-center">
                {[
                  { label: "To start", value: idea.startup_cost_ugx },
                  { label: "Each month", value: idea.monthly_operating_cost_ugx },
                  { label: "Could earn", value: idea.realistic_monthly_revenue_ugx },
                ].map((f) => (
                  <div key={f.label}>
                    <p className="text-[10px] font-semibold uppercase text-muted">
                      {f.label}
                    </p>
                    {/* Whole units straight through: the prompt asked for whole
                        units and the schema checked for a non-negative number. */}
                    <p className="mt-0.5 font-mono text-sm font-bold">
                      {f.value.toLocaleString("en-GB")} {currency}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold">Do this week</p>
                <ol className="mt-1.5 space-y-1">
                  {idea.first_steps.map((s, j) => (
                    <li key={j} className="text-sm text-muted">
                      <span className="mr-1.5 font-mono text-xs text-brand">{j + 1}.</span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>

              <p className="mt-4 rounded-lg bg-danger/5 px-3 py-2 text-xs">
                <span className="font-bold text-danger">Biggest risk: </span>
                <span className="text-muted">{idea.main_risk}</span>
              </p>
            </article>
          ))}
        </div>
      )}
    </AiPanel>
  );
}
