"use client";

import { useState } from "react";
import { AiPanel, GenerateButton, type Allowance } from "@/components/ai/ai-panel";
import { generateBusinessPlanAction } from "@/lib/ai/actions";
import { Field } from "@/components/ui/field";

type PlanResponse = {
  executive_summary: string;
  sections: Array<{ heading: string; body: string; key_numbers: string[] }>;
  financial_summary: {
    currency: string;
    startup_costs: number;
    monthly_costs: number;
    monthly_revenue_target: number;
    break_even_months: number;
  };
  milestones: Array<{ when: string; what: string }>;
  risks: Array<{ risk: string; mitigation: string }>;
  assumptions: string[];
  warnings: string[];
};

/**
 * Business plan.
 *
 * Financial figures are whole units, not minor units, because the prompt asks
 * the model for whole units and the schema checks for non-negative numbers.
 * Running them through toMinorUnits would be wrong by a factor of a hundred
 * for UGX, so they are formatted directly.
 */
export function BusinessPlanStudio({ allowance }: { allowance: Allowance }) {
  const [summary, setSummary] = useState("");

  return (
    <AiPanel<PlanResponse>
      allowance={allowance}
      form={(run) => (
        <div className="rounded-xl border border-border bg-surface p-5">
          <Field
            label="Anything the plan must cover"
            name="summary"
            hint="Optional. A sentence about your situation helps; the business details above are already included."
          >
            <textarea
              className="textarea"
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={2000}
              placeholder="e.g. Starting from a home kitchen in Nakawa, targeting office workers."
            />
          </Field>

          <div className="mt-4">
            <GenerateButton
              run={run}
              call={() => generateBusinessPlanAction(summary)}
              label="Write the business plan"
              busyLabel="Writing… (this takes a minute)"
            />
          </div>
          <p className="mt-2 text-xs text-muted">
            A full plan is a long generation. It may take 30 to 90 seconds.
          </p>
        </div>
      )}
    >
      {(data) => {
        const f = data.financial_summary;
        return (
          <div className="space-y-6">
            <section>
              <h3 className="text-sm font-bold">Executive summary</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                {data.executive_summary}
              </p>
            </section>

            <section className="grid grid-cols-2 gap-3 rounded-xl bg-surface-2 p-4 sm:grid-cols-5">
              {[
                { label: "To start", value: f.startup_costs },
                { label: "Each month", value: f.monthly_costs },
                { label: "Revenue target", value: f.monthly_revenue_target },
              ].map((row) => (
                <div key={row.label}>
                  <p className="text-[10px] font-semibold uppercase text-muted">
                    {row.label}
                  </p>
                  <p className="mt-0.5 font-mono text-xs font-bold">
                    {row.value.toLocaleString("en-GB")} {f.currency}
                  </p>
                </div>
              ))}
              <div>
                <p className="text-[10px] font-semibold uppercase text-muted">
                  Break-even
                </p>
                <p className="mt-0.5 font-mono text-xs font-bold">
                  {f.break_even_months === 0
                    ? "Not estimated"
                    : `${f.break_even_months} months`}
                </p>
              </div>
              <p className="col-span-full text-[10px] text-muted">
                Figures are the model&rsquo;s estimates, not research. See the
                assumptions above before you rely on any of them.
              </p>
            </section>

            {data.sections.map((s, i) => (
              <section key={i}>
                <h3 className="text-sm font-bold">{s.heading}</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                  {s.body}
                </p>
                {s.key_numbers.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {s.key_numbers.map((k, j) => (
                      <li key={j} className="font-mono text-xs text-brand">· {k}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}

            {data.milestones.length > 0 && (
              <section>
                <h3 className="text-sm font-bold">Milestones</h3>
                <ul className="mt-2 space-y-1.5">
                  {data.milestones.map((m, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="w-20 shrink-0 font-mono text-xs text-brand">
                        {m.when}
                      </span>
                      <span className="text-muted">{m.what}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {data.risks.length > 0 && (
              <section>
                <h3 className="text-sm font-bold">Risks</h3>
                <ul className="mt-2 space-y-2">
                  {data.risks.map((r, i) => (
                    <li key={i} className="rounded-lg bg-surface-2 px-3 py-2">
                      <p className="text-sm font-semibold">{r.risk}</p>
                      <p className="text-xs text-muted">{r.mitigation}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        );
      }}
    </AiPanel>
  );
}
