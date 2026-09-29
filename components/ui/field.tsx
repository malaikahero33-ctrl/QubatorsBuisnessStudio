"use client";

/**
 * A labelled form field with inline error or hint text.
 *
 * The three existing forms each carry their own copy of this. New forms use
 * this one; the older ones can be migrated whenever they are next touched,
 * rather than as part of an unrelated change.
 *
 * The label wraps the control, so the accessible name comes for free and there
 * is no id/htmlFor pairing to forget. The error is wired with
 * aria-describedby so a screen reader announces why the field was refused.
 */

import { useFormStatus } from "react-dom";

export function Field({
  label,
  name,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  name: string;
  hint?: string;
  error?: string;
  /** Applied to the wrapper, so a narrow field can live in a wide grid. */
  className?: string;
  children: React.ReactNode;
}) {
  return (
    // "block" is always kept: a label is inline by default, which breaks any
    // grid or flex layout it is dropped into.
    <label className={className ? `block ${className}` : "block"}>
      <span className="mb-1.5 block text-xs font-semibold text-muted">{label}</span>
      {children}
      {error ? (
        <span
          id={`${name}-error`}
          className="mt-1 block text-xs text-danger"
          role="alert"
        >
          {error}
        </span>
      ) : hint ? (
        <span id={`${name}-hint`} className="mt-1 block text-xs text-muted">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

/**
 * Props that wire a control to its error and hint text.
 *
 * The red border comes from `.input[aria-invalid="true"]` in globals.css, so
 * the class stays plain "input" — the attribute is the styling hook.
 */
export function fieldA11y(name: string, error?: string, hint?: string) {
  return {
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": error ? `${name}-error` : hint ? `${name}-hint` : undefined,
  };
}

/** A small submit button that disables itself while the action is in flight. */
export function SubmitButton({
  label,
  pendingLabel,
  variant = "btn-primary",
}: {
  label: string;
  pendingLabel: string;
  variant?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={variant} disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}
