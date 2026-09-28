"use client";

/**
 * Auth form shell.
 *
 * Thin on purpose: it owns only the pending/error presentation. Validation
 * lives in the server action, because a client-side check is a convenience,
 * not a guarantee.
 */

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import type { ActionState } from "@/lib/auth/actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending}>
      {pending ? "Working…" : label}
    </button>
  );
}

export type AuthFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  submitLabel: string;
  footnote?: React.ReactNode;
};

export function AuthForm({ action, children, submitLabel, footnote }: AuthFormProps) {
  const [state, formAction] = useActionState(action, { status: "idle" } as ActionState);

  return (
    <form action={formAction} className="space-y-4">
      {children}

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

      <SubmitButton label={submitLabel} />

      {footnote && <div className="pt-1 text-center text-sm text-muted">{footnote}</div>}
    </form>
  );
}

export function Field({
  label,
  name,
  type = "text",
  required,
  autoComplete,
  defaultValue,
  error,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  defaultValue?: string;
  error?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted">{label}</span>
      <input
        className="input"
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
      />
      {error && (
        <span id={`${name}-error`} className="mt-1 block text-xs text-danger">
          {error}
        </span>
      )}
    </label>
  );
}

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid h-10 w-10 place-content-center rounded-xl bg-brand text-lg font-extrabold text-white">
          Q
        </span>
        <div>
          <p className="text-sm font-bold">Qubators</p>
          <p className="text-xs text-muted">Business Studio</p>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-lg">
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export function SetupNotice({ missing }: { missing: string[] }) {
  return (
    <div className="mt-4 rounded-lg border border-dashed border-brand bg-brand-soft p-3 text-xs text-brand-ink">
      <p className="font-bold">Supabase is not configured yet</p>
      <ol className="mt-1.5 list-decimal space-y-0.5 pl-4">
        <li>
          Create a free project at{" "}
          <a className="underline" href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">
            supabase.com
          </a>
        </li>
        <li>
          Copy <code className="font-mono">.env.example</code> to <code className="font-mono">.env.local</code>
        </li>
        <li>
          Fill in: <code className="font-mono">{missing.join(", ")}</code>
        </li>
        <li>
          Run <code className="font-mono">npm run db:push</code> to create the tables
        </li>
      </ol>
      <p className="mt-2">
        <Link href="/" className="underline">
          Back to the home page
        </Link>
      </p>
    </div>
  );
}
