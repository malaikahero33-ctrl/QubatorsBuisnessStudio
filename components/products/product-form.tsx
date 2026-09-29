"use client";

/**
 * The product form, used for both adding and editing.
 *
 * Thin on purpose: validation lives in the server action, this owns only the
 * pending state and the field errors. Same rule as the business form.
 *
 * The product code (SKU) sits behind a collapsed "advanced" section. A founder
 * selling mango juice has never heard of a SKU, and asking for one up front
 * makes the form look like software rather than a business.
 */

import { useActionState, useEffect } from "react";
import type { ActionState } from "@/lib/auth/actions";
import { Field, SubmitButton, fieldA11y } from "@/components/ui/field";

export type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price_minor: number;
  cost_minor: number;
  sku: string | null;
  inventory_count: number;
  is_active: boolean;
};

export function ProductForm({
  action,
  product,
  currencySymbol,
  onDone,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  /** Present when editing, absent when adding. */
  product?: ProductRow;
  currencySymbol: string;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(action, { status: "idle" } as ActionState);
  const f = state.status === "error" ? state.fields ?? {} : {};

  // Move focus to the first problem so a long form is not hunted through.
  useEffect(() => {
    if (state.status === "error") {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [state]);

  // A successful edit returns "Saved" rather than redirecting, so the editor
  // can close itself. Creating redirects to the list, so this only runs on edit.
  useEffect(() => {
    if (state.status === "success" && product) onDone();
  }, [state, product, onDone]);

  const isEdit = Boolean(product);

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

      {/* Rendered via a truthiness check rather than `isEdit &&` so TypeScript
          narrows `product` to defined. Boolean() is not a type guard. */}
      {product && <input type="hidden" name="id" value={product.id} />}

      <Field label="What do you sell?" name="name" error={f.name}>
        <input
          className="input"
          name="name"
          required
          autoFocus
          maxLength={160}
          defaultValue={product?.name}
          placeholder="e.g. Mango juice, 500ml bottle"
          {...fieldA11y("name", f.name)}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Category"
          name="category"
          hint="Optional. Helps you group things later."
          error={f.category}
        >
          <input
            className="input"
            name="category"
            maxLength={120}
            defaultValue={product?.category ?? ""}
            placeholder="e.g. Drinks"
            {...fieldA11y("category", f.category)}
          />
        </Field>

        <Field
          label="How much do you sell it for?"
          name="price"
          hint={`In ${currencySymbol}. Type 15000 or 15,000.`}
          error={f.price}
        >
          <input
            className="input"
            name="price"
            required
            inputMode="decimal"
            defaultValue={product ? String(product.price_minor) : ""}
            placeholder="15000"
            {...fieldA11y("price", f.price)}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="What does it cost you?"
          name="cost"
          hint="Optional. Leave blank if you do not know. This is how you find out your profit."
          error={f.cost}
        >
          <input
            className="input"
            name="cost"
            inputMode="decimal"
            defaultValue={product && product.cost_minor ? String(product.cost_minor) : ""}
            placeholder="8000"
            {...fieldA11y("cost", f.cost)}
          />
        </Field>

        <Field
          label="How many do you have?"
          name="stock"
          hint="Optional. Put 0 if you do not count stock."
          error={f.stock}
        >
          <input
            className="input"
            name="stock"
            inputMode="numeric"
            defaultValue={product ? String(product.inventory_count) : ""}
            placeholder="20"
            {...fieldA11y("stock", f.stock)}
          />
        </Field>
      </div>

      <Field
        label="Description"
        name="description"
        hint="Optional. What is in it, how big, anything a customer would ask."
        error={f.description}
      >
        <textarea
          className="textarea"
          name="description"
          rows={3}
          maxLength={2000}
          defaultValue={product?.description ?? ""}
          placeholder="e.g. Made from local mangoes, no added sugar, 500ml bottle"
          {...fieldA11y("description", f.description)}
        />
      </Field>

      <details className="rounded-xl border border-border px-4 py-3">
        <summary className="cursor-pointer text-xs font-semibold text-muted">
          Advanced — product code
        </summary>
        <div className="mt-3">
          <Field
            label="Product code"
            name="sku"
            hint="Optional. A short code you use to identify this product, e.g. MGJ-500."
            error={f.sku}
          >
            <input
              className="input"
              name="sku"
              maxLength={60}
              defaultValue={product?.sku ?? ""}
              placeholder="MGJ-500"
              {...fieldA11y("sku", f.sku)}
            />
          </Field>
        </div>
      </details>

      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={product ? product.is_active : true}
          className="mt-0.5"
        />
        <span>
          I am selling this
          <span className="block text-xs text-muted">
            Untick to hide it from new orders. It stays in your history.
          </span>
        </span>
      </label>

      <div className="flex items-center gap-3">
        <SubmitButton
          label={isEdit ? "Save changes" : "Add this product"}
          pendingLabel="Saving…"
        />
        <button type="button" onClick={onDone} className="btn btn-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}
