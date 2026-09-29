"use client";

/**
 * Finance screen.
 *
 * Two things at once: a form to record money in or out, and the shape of the
 * business over time. The month bars are the point — a total alone tells an
 * owner nothing about whether things are improving.
 */

import { useActionState, useEffect, useRef, useState } from "react";
import { createTransactionAction, deleteTransactionAction } from "@/lib/finance/actions";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type LedgerSummary,
} from "@/lib/finance/summarise";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import { Field, SubmitButton, fieldA11y } from "@/components/ui/field";
import type { ActionState } from "@/lib/auth/actions";

export type FinanceRow = {
  id: string;
  type: "income" | "expense";
  amount_minor: number;
  category: string | null;
  description: string | null;
  occurred_at: string;
  customer: { name: string } | null;
  order: { order_number: string } | null;
};

function today(): string {
  // Computed in the browser so the date is the user's, not the server's.
  // A fixed date would be wrong for everyone east of UTC.
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function RecordForm({ currency }: { currency: CurrencyCode }) {
  const [state, formAction] = useActionState(createTransactionAction, {
    status: "idle",
  } as ActionState);
  const [type, setType] = useState<"income" | "expense">("expense");
  const formRef = useRef<HTMLFormElement>(null);
  const f = state.status === "error" ? (state.fields ?? {}) : {};
  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  // Clear the inputs once the money is saved. Without this the owner has to
  // delete the old amount by hand before entering the next one, which is how
  // double entries happen.
  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      setType("expense");
    }
  }, [state.status]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-4 rounded-xl border border-border bg-surface-2 p-5"
    >
      <h2 className="text-sm font-bold">Record money</h2>

      {state.status === "error" && (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p role="status" className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
          {state.message}
        </p>
      )}

      <fieldset>
        <legend className="mb-1.5 text-xs font-semibold text-muted">Direction</legend>
        <div className="flex gap-2">
          {(["expense", "income"] as const).map((value) => (
            <label key={value} className="flex-1">
              <input
                type="radio"
                name="type"
                value={value}
                checked={type === value}
                onChange={() => setType(value)}
                className="peer sr-only"
              />
              <span className="block cursor-pointer rounded-lg border border-border px-3 py-2 text-center text-sm font-semibold text-muted transition peer-checked:border-brand peer-checked:bg-brand/10 peer-checked:text-brand">
                {value === "income" ? "Money in" : "Money out"}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={`Amount (${currency})`} name="amount_minor" error={f.amount_minor}>
          <input
            className="input"
            name="amount_minor"
            inputMode="numeric"
            placeholder="0"
            required
            {...fieldA11y("amount_minor", f.amount_minor)}
          />
        </Field>

        <Field label="Date" name="occurred_on" error={f.occurred_on}>
          <input
            className="input"
            name="occurred_on"
            type="date"
            defaultValue={today()}
            required
            {...fieldA11y("occurred_on", f.occurred_on)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" name="category">
          <select className="select" name="category" defaultValue="">
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>

        <Field label="Description" name="description" hint="Optional. What it was for.">
          <input className="input" name="description" maxLength={300} />
        </Field>
      </div>

      <p className="text-xs text-muted">
        Amounts are whole numbers of {currency}. There are no decimals to round.
      </p>

      <SubmitButton
        label={type === "income" ? "Record money in" : "Record spending"}
        pendingLabel="Saving…"
      />
    </form>
  );
}

function MonthBars({ summary, currency }: { summary: LedgerSummary; currency: CurrencyCode }) {
  if (summary.months.length === 0) return null;

  // Scale every bar against the largest month so the chart is readable whether
  // the business turns over 100k or 100m.
  const peak = Math.max(
    ...summary.months.map((m) => Math.max(m.incomeMinor, m.expenseMinor)),
    1,
  );

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-sm font-bold">Month by month</h2>
      <p className="mt-1 text-xs text-muted">Bars are scaled to the largest month shown.</p>

      <ul className="mt-4 space-y-4">
        {summary.months.map((m) => (
          <li key={m.month}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-semibold">{m.label}</span>
              <span
                className={`font-mono text-xs font-semibold ${
                  m.netMinor >= 0 ? "text-success" : "text-danger"
                }`}
              >
                {m.netMinor >= 0 ? "+" : "−"}
                {formatMoney(Math.abs(m.netMinor), currency)}
              </span>
            </div>

            <div className="mt-1.5 space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-[10px] text-muted">In</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-success"
                    style={{ width: `${Math.max((m.incomeMinor / peak) * 100, m.incomeMinor > 0 ? 2 : 0)}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right font-mono text-[10px] text-muted">
                  {formatMoney(m.incomeMinor, currency)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-[10px] text-muted">Out</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-danger"
                    style={{ width: `${Math.max((m.expenseMinor / peak) * 100, m.expenseMinor > 0 ? 2 : 0)}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right font-mono text-[10px] text-muted">
                  {formatMoney(m.expenseMinor, currency)}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CategoryBreakdown({
  summary,
  currency,
}: {
  summary: LedgerSummary;
  currency: CurrencyCode;
}) {
  if (summary.expensesByCategory.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-sm font-bold">Where the money went</h2>
      <ul className="mt-3 space-y-2.5">
        {summary.expensesByCategory.map((c) => (
          <li key={c.category}>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate font-medium">{c.category}</span>
              <span className="shrink-0 font-mono text-muted">
                {formatMoney(c.amountMinor, currency)} · {Math.round(c.share * 100)}%
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${Math.max(c.share * 100, 1)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FinanceManager({
  rows,
  summary,
  currency,
}: {
  rows: FinanceRow[];
  summary: LedgerSummary;
  currency: CurrencyCode;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);

  const profitTone =
    summary.netMinor > 0 ? "text-success" : summary.netMinor < 0 ? "text-danger" : "";

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Money in", value: summary.incomeMinor, tone: "text-success" },
          { label: "Money out", value: summary.expenseMinor, tone: "text-foreground" },
          { label: "Profit", value: summary.netMinor, tone: profitTone },
          {
            label: "Margin",
            value: null,
            tone: "text-foreground",
            text: summary.marginPercent === null
              ? "—"
              : `${summary.marginPercent.toFixed(0)}%`,
          },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-semibold text-muted">{s.label}</p>
            <p className={`mt-1.5 text-2xl font-extrabold tracking-tight ${s.tone}`}>
              {"text" in s && s.text ? s.text : formatMoney(s.value ?? 0, currency)}
            </p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <RecordForm currency={currency} />
        <div className="space-y-6">
          <MonthBars summary={summary} currency={currency} />
          <CategoryBreakdown summary={summary} currency={currency} />
        </div>
      </div>

      <section className="rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-bold">Every entry</h2>
          <span className="text-xs text-muted">{rows.length} shown</span>
        </div>

        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">
            Nothing recorded yet. Money in and money out both go here.
          </p>
        ) : (
          <ul>
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-5 py-3 last:border-0"
              >
                <span
                  className={`w-11 shrink-0 text-xs font-bold ${
                    row.type === "income" ? "text-success" : "text-danger"
                  }`}
                >
                  {row.type === "income" ? "+" : "−"}
                </span>

                <span className="font-mono text-sm font-semibold">
                  {formatMoney(row.amount_minor, currency)}
                </span>

                <span className="min-w-0 flex-1 truncate text-sm">
                  {row.description || row.category || "No description"}
                </span>

                {row.category && (
                  <span className="hidden text-xs text-muted sm:inline">{row.category}</span>
                )}

                <span className="text-xs text-muted">
                  {new Date(row.occurred_at).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>

                {confirming === row.id ? (
                  <span className="flex items-center gap-2">
                    {/* The real form lives here, not around the first button:
                        a form with only a type="button" trigger never submits. */}
                    <form
                      action={(fd) => {
                        fd.set("id", row.id);
                        deleteTransactionAction(fd);
                      }}
                    >
                      <button type="submit" className="btn btn-sm btn-danger">
                        Really delete
                      </button>
                    </form>
                    <button
                      className="btn btn-sm"
                      type="button"
                      onClick={() => setConfirming(null)}
                    >
                      Keep
                    </button>
                  </span>
                ) : (
                  <button
                    className="btn btn-sm"
                    type="button"
                    onClick={() => setConfirming(row.id)}
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
