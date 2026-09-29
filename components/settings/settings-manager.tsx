"use client";

/**
 * Settings forms.
 *
 * Three independent forms rather than one page-wide save. Each has its own
 * action state, so a validation failure in the phone number cannot stop the
 * business name being saved.
 */

import { useActionState, useEffect, useRef } from "react";
import {
  updateBusinessAction,
  updateProfileAction,
  updateSettingsAction,
} from "@/lib/settings/actions";
import { BUSINESS_STAGES } from "@/lib/validation/schemas";
import { Field, SubmitButton, fieldA11y } from "@/components/ui/field";
import type { CurrencyCode } from "@/lib/money";
import type { ActionState } from "@/lib/auth/actions";

const ONBOARDING_STEPS = [
  { value: "create_business", label: "Create the business" },
  { value: "describe_idea", label: "Describe the idea" },
  { value: "generate_plan", label: "Generate the plan" },
  { value: "build_brand", label: "Build the brand" },
  { value: "add_product", label: "Add a product" },
  { value: "first_customer", label: "Get a customer" },
  { value: "done", label: "Done" },
] as const;

function Banner({ state }: { state: ActionState }) {
  if (state.status === "idle") return null;
  const isError = state.status === "error";
  return (
    <p
      role={isError ? "alert" : "status"}
      className={`rounded-lg border px-3 py-2 text-sm ${
        isError
          ? "border-danger/40 bg-danger/10 text-danger"
          : "border-success/40 bg-success/10 text-success"
      }`}
    >
      {state.message}
    </p>
  );
}

export type SettingsManagerProps = {
  business: {
    id: string;
    name: string;
    industry: string | null;
    location: string | null;
    stage: string | null;
    currency: CurrencyCode;
    target_customer: string | null;
    brand_personality: string | null;
    goals: string | null;
  };
  profile: { full_name: string; phone: string; country_code: string };
  settings: {
    notify_new_order: boolean;
    notify_consultation: boolean;
    weekly_digest: boolean;
    onboarding_step: string;
  };
  aiConfigured: boolean;
  productCount: number;
};

export function SettingsManager({
  business,
  profile,
  settings,
  aiConfigured,
  productCount,
}: SettingsManagerProps) {
  const [bizState, bizAction] = useActionState(updateBusinessAction, {
    status: "idle",
  } as ActionState);

  const [profileState, profileAction] = useActionState(updateProfileAction, {
    status: "idle",
  } as ActionState);

  const [prefState, prefAction] = useActionState(updateSettingsAction, {
    status: "idle",
  } as ActionState);

  const bf = bizState.status === "error" ? (bizState.fields ?? {}) : {};
  const pf = profileState.status === "error" ? (profileState.fields ?? {}) : {};

  return (
    <div className="space-y-8">
      {/* ---------------------------------------------------------------- */}
      <section className="rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-bold">Your business</h2>
          <p className="mt-0.5 text-xs text-muted">
            Shown on every screen in this studio, and used to give advice that fits.
          </p>
        </div>

        <form action={bizAction} className="space-y-4 p-5">
          <input type="hidden" name="id" value={business.id} />
          <Banner state={bizState} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business name" name="name" error={bf.name}>
              <input
                className="input"
                name="name"
                defaultValue={business.name}
                required
                minLength={2}
                maxLength={120}
                {...fieldA11y("name", bf.name)}
              />
            </Field>

            <Field label="Stage" name="stage" hint="Where you are right now.">
              <select className="select" name="stage" defaultValue={business.stage ?? "idea"}>
                {BUSINESS_STAGES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Industry" name="industry">
              <input className="input" name="industry" defaultValue={business.industry ?? ""} maxLength={120} />
            </Field>
            <Field label="Location" name="location">
              <input className="input" name="location" defaultValue={business.location ?? ""} maxLength={160} />
            </Field>
          </div>

          <Field
            label="Who you sell to"
            name="target_customer"
            hint="The more specific this is, the better the advice. “Women in Kampala who want healthy snacks”, not “everyone”."
          >
            <textarea
              className="textarea"
              name="target_customer"
              rows={2}
              defaultValue={business.target_customer ?? ""}
              maxLength={2000}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Brand personality"
              name="brand_personality"
              hint="Three or four words. Warm, bold, practical."
            >
              <textarea
                className="textarea"
                name="brand_personality"
                rows={2}
                defaultValue={business.brand_personality ?? ""}
                maxLength={1000}
              />
            </Field>
            <Field label="Goals" name="goals" hint="What you are trying to achieve.">
              <textarea
                className="textarea"
                name="goals"
                rows={2}
                defaultValue={business.goals ?? ""}
                maxLength={2000}
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <SubmitButton label="Save business" pendingLabel="Saving…" />
            <p className="text-xs text-muted">
              Currency is fixed at <strong>{business.currency}</strong>. {productCount}{" "}
              {productCount === 1 ? "product is" : "products are"} priced in it, so
              changing it here would relabel old prices without converting them.
            </p>
          </div>
        </form>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-bold">About you</h2>
          <p className="mt-0.5 text-xs text-muted">
            Your name and phone number. Used for your account only.
          </p>
        </div>

        <form action={profileAction} className="space-y-4 p-5">
          <Banner state={profileState} />

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Full name" name="full_name" error={pf.full_name}>
              <input
                className="input"
                name="full_name"
                defaultValue={profile.full_name}
                required
                minLength={2}
                {...fieldA11y("full_name", pf.full_name)}
              />
            </Field>

            <Field
              label="Phone"
              name="phone"
              hint="Local format is fine."
              error={pf.phone}
            >
              <input
                className="input"
                name="phone"
                type="tel"
                inputMode="tel"
                defaultValue={profile.phone}
                placeholder="0772 123 456"
                {...fieldA11y("phone", pf.phone, "Local format is fine.")}
              />
            </Field>

            <Field label="Country code" name="country_code" hint="Two letters, e.g. UG" error={pf.country_code}>
              <input
                className="input"
                name="country_code"
                defaultValue={profile.country_code}
                maxLength={2}
                placeholder="UG"
                {...fieldA11y("country_code", pf.country_code, "Two letters, e.g. UG")}
              />
            </Field>
          </div>

          <SubmitButton label="Save your details" pendingLabel="Saving…" />
        </form>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-bold">Notifications and progress</h2>
          <p className="mt-0.5 text-xs text-muted">
            Preferences are saved now. Nothing is emailed until an email provider is
            connected.
          </p>
        </div>

        <form action={prefAction} className="space-y-4 p-5">
          <input type="hidden" name="business_id" value={business.id} />
          <Banner state={prefState} />

          <fieldset className="space-y-2.5">
            <legend className="mb-2 text-xs font-semibold text-muted">Tell me about</legend>

            {[
              { name: "notify_new_order", label: "New orders", checked: settings.notify_new_order },
              { name: "notify_consultation", label: "Consultation requests", checked: settings.notify_consultation },
              { name: "weekly_digest", label: "A weekly summary of how the business is doing", checked: settings.weekly_digest },
            ].map((item) => (
              <label key={item.name} className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  name={item.name}
                  defaultChecked={item.checked}
                  className="mt-0.5 h-4 w-4 rounded border-border"
                />
                <span className="text-sm">{item.label}</span>
              </label>
            ))}
          </fieldset>

          <Field
            label="Setup progress"
            name="onboarding_step"
            hint="Where you are in getting the business running."
            className="max-w-xs"
          >
            <select className="select" name="onboarding_step" defaultValue={settings.onboarding_step}>
              {ONBOARDING_STEPS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </Field>

          <SubmitButton label="Save preferences" pendingLabel="Saving…" />
        </form>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-bold">AI features</h2>
        </div>
        <div className="p-5">
          {aiConfigured ? (
            <p className="text-sm text-success">
              An AI provider key is configured. The AI features are available.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted">
                The AI features — idea generation, business plans, brand kits and
                marketing copy — are built but need an API key before they can run.
              </p>
              <p className="mt-3 text-sm">
                Add <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs">
                  AI_API_KEY
                </code>{" "}
                to <code className="font-mono text-xs">.env.local</code> and restart the
                server. Which provider is still an open decision — see{" "}
                <code className="font-mono text-xs">docs/DECISIONS.md</code>, question 1.
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
