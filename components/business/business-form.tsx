"use client";

/**
 * Business creation form.
 *
 * Thin on purpose. Validation lives in the server action; this owns only
 * the pending state and the field-level error display.
 */

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/auth/actions";
import { BUSINESS_STAGES } from "@/lib/validation/schemas";
import { SUPPORTED_CURRENCIES } from "@/lib/money";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "Creating…" : "Create my business"}
    </button>
  );
}

function Field({
  label,
  name,
  hint,
  error,
  children,
}: {
  label: string;
  name: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export function BusinessForm({
  action,
  defaultCurrency,
  defaultStage,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  defaultCurrency: string;
  defaultStage: string;
}) {
  const [state, formAction] = useActionState(action, { status: "idle" } as ActionState);

  // Move focus to the first problem so a long form is not hunted through.
  useEffect(() => {
    if (state.status === "error") {
      const first = document.querySelector<HTMLElement>(".field-error-target");
      first?.focus();
    }
  }, [state]);

  const f = state.status === "error" ? state.fields ?? {} : {};

  return (
    <form action={formAction} className="space-y-5">
      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {state.message}
        </p>
      )}

      <Field label="What is your business called?" name="name" error={f.name}>
        <input
          className="input"
          name="name"
          required
          autoFocus
          maxLength={120}
          placeholder="e.g. Sunrise Foods"
          aria-invalid={f.name ? true : undefined}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="What do you do?"
          name="industry"
          hint="One line. This is what the AI will assume about you."
          error={f.industry}
        >
          <input
            className="input"
            name="industry"
            maxLength={120}
            placeholder="e.g. Food and beverage"
            aria-invalid={f.industry ? true : undefined}
          />
        </Field>

        <Field label="Where are you?" name="location" error={f.location}>
          <input
            className="input"
            name="location"
            maxLength={120}
            placeholder="e.g. Kampala, Uganda"
            aria-invalid={f.location ? true : undefined}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Currency" name="currency" hint="Prices are stored in this currency.">
          <select className="select" name="currency" defaultValue={defaultCurrency}>
            {SUPPORTED_CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Where are you right now?" name="stage">
          <select className="select" name="stage" defaultValue={defaultStage}>
            {BUSINESS_STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label} — {s.hint}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset className="rounded-xl border border-border p-4">
        <legend className="px-1.5 text-xs font-semibold text-muted">
          Who is this for? (optional)
        </legend>
        <p className="mb-3 text-xs text-muted">
          The AI uses this. The more specific you are, the better it can help.
        </p>
        <div className="space-y-4">
          <Field label="Your customers" name="target_customer">
            <textarea
              className="textarea"
              name="target_customer"
              rows={2}
              maxLength={400}
              placeholder="e.g. Urban professionals aged 20-35 who buy snacks weekly"
            />
          </Field>

          <Field label="What do you want to achieve?" name="goals">
            <textarea
              className="textarea"
              name="goals"
              rows={2}
              maxLength={400}
              placeholder="e.g. Reach 500 direct customers within 12 months"
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Lowest price you sell at"
              name="price_min"
              hint="Numbers only. Leave blank if unsure."
              error={f.price_min}
            >
              <input
                className="input"
                name="price_min"
                inputMode="decimal"
                placeholder="2000"
                aria-invalid={f.price_min ? true : undefined}
              />
            </Field>
            <Field
              label="Highest price you sell at"
              name="price_max"
              error={f.price_max}
            >
              <input
                className="input"
                name="price_max"
                inputMode="decimal"
                placeholder="15000"
                aria-invalid={f.price_max ? true : undefined}
              />
            </Field>
          </div>
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <SubmitButton />
        <span className="text-xs text-muted">You can change all of this later.</span>
      </div>
    </form>
  );
}
