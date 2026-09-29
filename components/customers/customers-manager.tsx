"use client";

/**
 * Customer list and editor.
 *
 * Deliberately simpler than the products manager: customers have no inventory
 * and no archive state, so there is less to show and fewer ways to get it
 * wrong.
 */

import { useState, useTransition } from "react";
import { useActionState } from "react";
import { saveCustomerAction, deleteCustomerAction } from "@/lib/customers/actions";
import { CUSTOMER_STAGES } from "@/lib/validation/schemas";
import { formatMoney } from "@/lib/money";
import type { ActionState } from "@/lib/auth/actions";
import type { CurrencyCode } from "@/lib/money";
import { Field, SubmitButton, fieldA11y } from "@/components/ui/field";

export type CustomerRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  stage: string;
  notes: string | null;
  lifetime_value_minor: number;
  created_at: string;
};

function CustomerForm({
  customer,
  onDone,
}: {
  customer?: CustomerRow;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(saveCustomerAction, { status: "idle" } as ActionState);
  const f = state.status === "error" ? state.fields ?? {} : {};

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-xl border border-border bg-surface-2 p-4"
      onSubmit={() => {
        // The action redirects on success, so unmounting on submit is safe
        // and stops the form flashing shut before the navigation lands.
        onDone();
      }}
    >
      {state.status === "error" && (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.message}
        </p>
      )}

      {customer && <input type="hidden" name="id" value={customer.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" name="name" error={f.name}>
          <input className="input" name="name" required maxLength={160} defaultValue={customer?.name} {...fieldA11y("name", f.name)} />
        </Field>

        <Field label="Stage" name="stage">
          <select className="select" name="stage" defaultValue={customer?.stage ?? "lead"}>
            {CUSTOMER_STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label} — {s.hint}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Phone" name="phone" hint="Local format is fine, e.g. 0772 123 456" error={f.phone}>
          <input className="input" name="phone" maxLength={40} defaultValue={customer?.phone ?? ""} {...fieldA11y("phone", f.phone)} />
        </Field>

        <Field label="Email" name="email" error={f.email}>
          <input className="input" name="email" type="email" maxLength={320} defaultValue={customer?.email ?? ""} {...fieldA11y("email", f.email)} />
        </Field>
      </div>

      <Field label="Location" name="location">
        <input className="input" name="location" maxLength={120} defaultValue={customer?.location ?? ""} />
      </Field>

      <Field label="Notes" name="notes">
        <textarea className="textarea" name="notes" rows={2} defaultValue={customer?.notes ?? ""} />
      </Field>

      <div className="flex items-center gap-3">
        <SubmitButton
          label={customer ? "Save changes" : "Add customer"}
          pendingLabel={customer ? "Saving…" : "Adding…"}
        />
        <button type="button" className="btn" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function CustomersManager({
  customers,
  currency,
}: {
  customers: CustomerRow[];
  currency: CurrencyCode;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const stageLabel = (value: string) =>
    CUSTOMER_STAGES.find((s) => s.value === value)?.label ?? value;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {customers.length} customer{customers.length === 1 ? "" : "s"}
        </p>
        {!adding && (
          <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
            Add customer
          </button>
        )}
      </div>

      {adding && (
        <CustomerForm
          onDone={() => {
            setAdding(false);
          }}
        />
      )}

      {customers.length === 0 && !adding ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
          <h2 className="text-sm font-bold">No customers yet</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
            Add the first person or shop who buys from you. You need at least a phone or an
            email for each one.
          </p>
          <button className="btn btn-primary btn-sm mt-4" onClick={() => setAdding(true)}>
            Add your first customer
          </button>
        </div>
      ) : (
        <ul className="rounded-xl border border-border bg-surface">
          {customers.map((c) => (
            <li key={c.id} className="border-b border-border last:border-0">
              {editingId === c.id ? (
                <div className="p-4">
                  <CustomerForm
                    customer={c}
                    onDone={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{c.name}</p>
                    <p className="truncate text-xs text-muted">
                      {[c.phone, c.email, c.location].filter(Boolean).join(" · ") || "No contact details"}
                    </p>
                  </div>

                  <span className="pill">{stageLabel(c.stage)}</span>

                  <span className="font-mono text-sm font-semibold">
                    {formatMoney(c.lifetime_value_minor, currency)}
                  </span>

                  <div className="flex gap-2">
                    <button className="btn btn-sm" onClick={() => setEditingId(c.id)}>
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      disabled={pending}
                      onClick={() => {
                        if (!confirm(`Delete ${c.name}? Orders keep their history.`)) return;
                        const fd = new FormData();
                        fd.set("id", c.id);
                        startTransition(async () => {
                          await deleteCustomerAction(fd);
                        });
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
