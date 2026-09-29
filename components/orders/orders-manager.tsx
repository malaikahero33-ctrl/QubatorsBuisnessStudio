"use client";

import { useState, useTransition } from "react";
import { OrderForm, type ProductOption, type CustomerOption } from "./order-form";
import { setOrderStatusAction, deleteOrderAction } from "@/lib/orders/actions";
import { ORDER_STATUSES } from "@/lib/validation/schemas";
import { formatMoney, type CurrencyCode } from "@/lib/money";

export type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  total_minor: number;
  placed_at: string;
  due_at: string | null;
  customer: { name: string } | null;
  items: Array<{ id: string; description: string; quantity: number; line_total_minor: number }>;
};

const statusTone: Record<string, string> = {
  pending: "pill-warn",
  confirmed: "pill-info",
  in_progress: "pill-brand",
  shipped: "pill-info",
  completed: "pill-success",
  cancelled: "pill-danger",
};

export function OrdersManager({
  orders,
  products,
  customers,
  currency,
}: {
  orders: OrderRow[];
  products: ProductOption[];
  customers: CustomerOption[];
  currency: CurrencyCode;
}) {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  const open = orders.filter((o) => o.status !== "completed" && o.status !== "cancelled");
  const closed = orders.filter((o) => o.status === "completed" || o.status === "cancelled");

  const revenue = orders
    .filter((o) => o.status === "completed")
    .reduce((sum, o) => sum + o.total_minor, 0);

  const card = (o: OrderRow) => (
    <li key={o.id} className="border-b border-border last:border-0">
      <details className="p-4">
        <summary className="flex cursor-pointer flex-wrap items-center gap-3">
          <span className="font-mono text-sm font-semibold">{o.order_number}</span>
          <span className="min-w-0 flex-1 truncate text-sm">{o.customer?.name ?? "No customer"}</span>
          <span className={`pill ${statusTone[o.status] ?? ""}`}>
            {ORDER_STATUSES.find((s) => s.value === o.status)?.label ?? o.status}
          </span>
          <span className="font-mono text-sm font-semibold">
            {formatMoney(o.total_minor, currency)}
          </span>
          <span className="hidden text-xs text-muted sm:inline">
            {new Date(o.placed_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
          </span>
        </summary>

        <div className="mt-4 space-y-4 pl-0 sm:pl-4">
          {o.items.length > 0 && (
            <ul className="space-y-1 text-sm">
              {o.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-4">
                  <span className="text-muted">
                    {item.quantity} × {item.description}
                  </span>
                  <span className="font-mono">{formatMoney(item.line_total_minor, currency)}</span>
                </li>
              ))}
            </ul>
          )}

          {o.due_at && (
            <p className="text-xs text-muted">
              Due {new Date(o.due_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <form
              action={(fd) =>
                startTransition(async () => {
                  fd.set("id", o.id);
                  await setOrderStatusAction(fd);
                })
              }
            >
              <select name="status" defaultValue={o.status} className="select" disabled={pending}>
                {ORDER_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <button className="btn btn-sm ml-2" disabled={pending}>
                Update
              </button>
            </form>

            <form
              action={(fd) =>
                startTransition(async () => {
                  fd.set("id", o.id);
                  await deleteOrderAction(fd);
                })
              }
            >
              <button
                className="btn btn-sm btn-danger"
                disabled={pending}
                onClick={(e) => {
                  if (!confirm(`Delete ${o.order_number}? Its lines go too.`)) e.preventDefault();
                }}
              >
                Delete
              </button>
            </form>
          </div>
        </div>
      </details>
    </li>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {open.length} open · {formatMoney(revenue, currency)} completed
        </p>
        {!adding && (
          <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
            New order
          </button>
        )}
      </div>

      {adding && (
        <OrderForm
          products={products}
          customers={customers}
          currency={currency}
          onDone={() => setAdding(false)}
        />
      )}

      {orders.length === 0 && !adding ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
          <h2 className="text-sm font-bold">No orders yet</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
            An order needs a customer and at least one line. The total is worked out by
            the database, so it cannot be typed in wrongly.
          </p>
          <button className="btn btn-primary btn-sm mt-4" onClick={() => setAdding(true)}>
            Create your first order
          </button>
        </div>
      ) : (
        <>
          {open.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-bold text-muted">Open</h2>
              <ul className="rounded-xl border border-border bg-surface">{open.map(card)}</ul>
            </section>
          )}
          {closed.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-bold text-muted">Completed and cancelled</h2>
              <ul className="rounded-xl border border-border bg-surface">{closed.map(card)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
