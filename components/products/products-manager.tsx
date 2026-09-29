"use client";

/**
 * The products screen: list, add, edit, archive, delete.
 *
 * One client component rather than separate pages, so a founder can add three
 * products without navigating three times. The list is passed in already
 * fetched and RLS-scoped; this owns only which form is open.
 *
 * Deleting is deliberately awkward and archiving is the default. A product that
 * has been ordered keeps its history, and the server action falls back to
 * archiving in exactly that case.
 */

import { useState } from "react";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import { saveProductAction, archiveProductAction, restoreProductAction, deleteProductAction } from "@/lib/products/actions";
import { ProductForm, type ProductRow } from "@/components/products/product-form";
import type { ActionState } from "@/lib/auth/actions";

/** currencySymbol is the form's hint text, e.g. "UGX". */
export function ProductsManager({
  products,
  currency,
}: {
  products: ProductRow[];
  currency: CurrencyCode;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const active = products.filter((p) => p.is_active);
  const archived = products.filter((p) => !p.is_active);
  const visible = showArchived ? products : active;

  const editing = editingId ? products.find((p) => p.id === editingId) : undefined;

  function close() {
    setAdding(false);
    setEditingId(null);
  }

  // Totals across the active catalogue, so the founder sees the shape of what
  // they sell at a glance.
  const totalRetail = active.reduce((s, p) => s + p.price_minor, 0);
  const totalCost = active.reduce((s, p) => s + p.cost_minor, 0);
  const marginKnown = active.filter((p) => p.cost_minor > 0).length;
  const totalMargin = totalRetail - totalCost;

  return (
    <div className="space-y-6">
      {/*
        The page owns the <h1>. Repeating it here produced two h1s and a
        duplicated title on screen - caught in a screenshot, not by any
        automated check. This is a toolbar only.
      */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted">
          {active.length} active · prices in {currency}
        </p>
        {!adding && !editing && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setAdding(true)}
          >
            Add a product
          </button>
        )}
      </header>

      {adding && (
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-4 text-sm font-bold">New product</h2>
          <ProductForm
            action={saveProductAction}
            currencySymbol={currency}
            onDone={close}
          />
        </section>
      )}

      {editing && (
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-4 text-sm font-bold">Edit {editing.name}</h2>
          <ProductForm
            action={saveProductAction}
            product={editing}
            currencySymbol={currency}
            onDone={close}
          />
        </section>
      )}

      {!adding && !editing && (
        <>
          {active.length > 0 && (
            <section className="grid gap-4 sm:grid-cols-3">
              <Summary label="Active products" value={String(active.length)} />
              <Summary
                label="Retail value if you sold everything"
                value={formatMoney(totalRetail, currency)}
              />
              <Summary
                label={marginKnown ? "Margin if you sold everything" : "Margin"}
                value={
                  marginKnown
                    ? formatMoney(totalMargin, currency)
                    : "Add your costs"
                }
                hint={
                  marginKnown
                    ? undefined
                    : "Enter what each product costs you to see your profit."
                }
              />
            </section>
          )}

          {visible.length === 0 ? (
            <section className="rounded-xl border border-border bg-surface px-5 py-12 text-center">
              <p className="text-sm text-muted">
                No products yet. Add your first one — it takes a name and a price.
              </p>
            </section>
          ) : (
            <section className="overflow-hidden rounded-xl border border-border bg-surface">
              <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-border px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-muted sm:grid-cols-[2fr_1fr_1fr_auto]">
                <span>Product</span>
                <span className="hidden sm:block">Price</span>
                <span className="hidden sm:block">Profit</span>
                <span className="text-right">Stock</span>
              </div>
              <ul>
                {visible.map((p) => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    currency={currency}
                    onEdit={() => setEditingId(p.id)}
                  />
                ))}
              </ul>
            </section>
          )}

          {archived.length > 0 && (
            <div className="text-center">
              <button
                type="button"
                className="text-xs text-muted underline"
                onClick={() => setShowArchived((v) => !v)}
              >
                {showArchived
                  ? "Hide archived products"
                  : `Show ${archived.length} archived product${archived.length === 1 ? "" : "s"}`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Summary({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="mt-1.5 text-xl font-extrabold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

function ProductRow({
  product,
  currency,
  onEdit,
}: {
  product: ProductRow;
  currency: CurrencyCode;
  onEdit: () => void;
}) {
  const margin = product.price_minor - product.cost_minor;
  const showMargin = product.cost_minor > 0;

  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-border px-5 py-3 last:border-0 sm:grid-cols-[2fr_1fr_1fr_auto]">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold">{product.name}</p>
          {!product.is_active && (
            <span className="pill pill-warn text-[10px]">archived</span>
          )}
        </div>
        <p className="truncate text-xs text-muted">
          {product.category || "No category"}
          {product.sku ? ` · ${product.sku}` : ""}
        </p>
      </div>

      <p className="hidden font-mono text-sm font-semibold sm:block">
        {formatMoney(product.price_minor, currency)}
      </p>

      <p
        className={`hidden font-mono text-sm font-semibold sm:block ${
          !showMargin ? "text-muted" : margin >= 0 ? "text-success" : "text-danger"
        }`}
      >
        {showMargin ? formatMoney(margin, currency) : "—"}
      </p>

      <div className="flex items-center justify-end gap-2">
        <span className="font-mono text-xs text-muted">{product.inventory_count}</span>
        <button
          type="button"
          onClick={onEdit}
          className="btn btn-sm"
          aria-label={`Edit ${product.name}`}
        >
          Edit
        </button>

        {product.is_active ? (
          <form action={archiveProductAction}>
            <input type="hidden" name="id" value={product.id} />
            <button type="submit" className="btn btn-sm" aria-label={`Archive ${product.name}`}>
              Archive
            </button>
          </form>
        ) : (
          <form action={restoreProductAction}>
            <input type="hidden" name="id" value={product.id} />
            <button type="submit" className="btn btn-sm" aria-label={`Restore ${product.name}`}>
              Restore
            </button>
          </form>
        )}

        <form action={deleteProductAction}>
          <input type="hidden" name="id" value={product.id} />
          <button
            type="submit"
            className="btn btn-sm"
            aria-label={`Delete ${product.name}`}
            title="Delete permanently"
          >
            Delete
          </button>
        </form>
      </div>

      <p className="col-span-2 font-mono text-sm font-semibold sm:hidden">
        {formatMoney(product.price_minor, currency)}
        {showMargin && (
          <span className={margin >= 0 ? "text-success" : "text-danger"}>
            {" "}
            ({formatMoney(margin, currency)} profit)
          </span>
        )}
      </p>
    </li>
  );
}
