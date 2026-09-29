"use client";

/**
 * Order builder.
 *
 * Lines are held in local state and serialised to JSON on submit. A form
 * cannot natively post an array, and the alternative — one field per line,
 * indexed by position — gets ugly the moment a line is removed.
 *
 * Prices are entered as text and converted to integer minor units here, so
 * the user can type "1,200,000" and the database still receives an integer.
 */

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { createOrderAction } from "@/lib/orders/actions";
import { ORDER_STATUSES } from "@/lib/validation/schemas";
import { formatMoney, parseMoneyInput, type CurrencyCode } from "@/lib/money";
import { Field, SubmitButton, fieldA11y } from "@/components/ui/field";
import type { ActionState } from "@/lib/auth/actions";

export type ProductOption = {
  id: string;
  name: string;
  price_minor: number;
  is_active: boolean;
};

export type CustomerOption = { id: string; name: string };

type Line = {
  key: number;
  product_id: string;
  description: string;
  quantity: string;
  price: string;
};

let nextKey = 1;
const blankLine = (): Line => ({
  key: nextKey++,
  product_id: "",
  description: "",
  quantity: "1",
  price: "",
});

export function OrderForm({
  products,
  customers,
  currency,
  onDone,
}: {
  products: ProductOption[];
  customers: CustomerOption[];
  currency: CurrencyCode;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(
    async (prev: ActionState, fd: FormData) => {
      // FormData is mutable, so the lines can be attached on the way to the
      // server action. A form cannot natively post an array, and one field
      // per line, indexed by position, breaks the moment a line is removed.
      const payload = lines
        .filter((l) => l.description.trim().length > 0)
        .map((l) => ({
          product_id: l.product_id || "",
          service_id: "",
          description: l.description.trim(),
          quantity: Math.max(1, Math.trunc(Number(l.quantity) || 1)),
          unit_price_minor: parseMoneyInput(l.price, currency) ?? 0,
        }));
      fd.set("items", JSON.stringify(payload));
      return createOrderAction(prev, fd);
    },
    { status: "idle" } as ActionState,
  );

  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const f = state.status === "error" ? state.fields ?? {} : {};

  // Recomputed on every keystroke so the running total is never stale, and so
  // the user sees the effect of a quantity change immediately.
  const total = useMemo(() => {
    let sum = 0;
    for (const line of lines) {
      const qty = Number(line.quantity);
      const price = parseMoneyInput(line.price, currency);
      if (Number.isFinite(qty) && qty > 0 && price !== null) sum += price * Math.trunc(qty);
    }
    return sum;
  }, [lines, currency]);

  const setLine = (key: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <form action={formAction} className="space-y-5 rounded-xl border border-border bg-surface-2 p-5">
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Customer" name="customer_id" error={f.customer_id}>
          <select className="select" name="customer_id" required {...fieldA11y("customer_id", f.customer_id)}>
            <option value="">Choose a customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Status" name="status">
          <select className="select" name="status" defaultValue="pending">
            {ORDER_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label} — {s.hint}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Due date" name="due_at" hint="Optional. When you expect to have delivered.">
        <input className="input" name="due_at" type="date" />
      </Field>

      <fieldset className="rounded-lg border border-border p-3">
        <legend className="px-1 text-xs font-semibold text-muted">What is being ordered</legend>

        <div className="space-y-3">
          {lines.map((line, index) => (
            <div key={line.key} className="grid gap-3 rounded-lg bg-surface p-3 sm:grid-cols-[1fr_5rem_1fr_auto]">
              <label className="block">
                <span className="sr-only">Product for line {index + 1}</span>
                <select
                  className="select"
                  value={line.product_id}
                  onChange={(e) => {
                    const p = products.find((x) => x.id === e.target.value);
                    setLine(line.key, {
                      product_id: e.target.value,
                      description: p?.name ?? line.description,
                      price: p ? String(p.price_minor) : line.price,
                    });
                  }}
                >
                  <option value="">Free text line</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id} disabled={!p.is_active}>
                      {p.name} · {formatMoney(p.price_minor, currency)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] text-muted">Qty</span>
                <input
                  className="input"
                  inputMode="numeric"
                  value={line.quantity}
                  onChange={(e) => setLine(line.key, { quantity: e.target.value })}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] text-muted">Unit price ({currency})</span>
                <input
                  className="input"
                  value={line.price}
                  placeholder="0"
                  onChange={(e) => setLine(line.key, { price: e.target.value })}
                />
              </label>

              <div className="flex items-end">
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={lines.length === 1}
                  title={lines.length === 1 ? "An order needs at least one line" : "Remove this line"}
                  onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                >
                  Remove
                </button>
              </div>

              <label className="block sm:col-span-4">
                <span className="mb-1 block text-[11px] text-muted">Description</span>
                <input
                  className="input"
                  value={line.description}
                  onChange={(e) => setLine(line.key, { description: e.target.value })}
                  placeholder="What this line is for"
                />
              </label>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setLines((prev) => [...prev, blankLine()])}
          >
            Add another line
          </button>
          <p className="text-sm font-semibold">
            Running total{" "}
            <span className="font-mono">{formatMoney(total, currency)}</span>
          </p>
        </div>
        <p className="mt-1 text-[11px] text-muted">
          Shown for your convenience. The database recalculates and stores the real total.
        </p>
      </fieldset>

      <Field label="Notes" name="notes">
        <textarea className="textarea" name="notes" rows={2} />
      </Field>

      <div className="flex items-center gap-3">
        <SubmitButton label="Create order" pendingLabel="Creating…" />
        <button type="button" className="btn" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}
