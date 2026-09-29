import { describe, expect, it } from "vitest";
import { createOrderSchema, orderItemSchema, ORDER_STATUSES } from "./schemas";

describe("orderItemSchema", () => {
  const line = {
    description: "Granola 250g",
    quantity: 40,
    unit_price_minor: 1_200_000,
  };

  it("accepts a normal line", () => {
    expect(orderItemSchema.safeParse(line).success).toBe(true);
  });

  it("rejects a fractional quantity", () => {
    const r = orderItemSchema.safeParse({ ...line, quantity: 1.5 });
    expect(r.success).toBe(false);
  });

  it("rejects zero and negative quantities", () => {
    expect(orderItemSchema.safeParse({ ...line, quantity: 0 }).success).toBe(false);
    expect(orderItemSchema.safeParse({ ...line, quantity: -3 }).success).toBe(false);
  });

  it("rejects a negative price", () => {
    expect(orderItemSchema.safeParse({ ...line, unit_price_minor: -1 }).success).toBe(false);
  });

  it("rejects a fractional price", () => {
    // A float price is the exact bug money.ts exists to prevent.
    const r = orderItemSchema.safeParse({ ...line, unit_price_minor: 1200.5 });
    expect(r.success).toBe(false);
  });

  it("allows a free line at zero", () => {
    expect(orderItemSchema.safeParse({ ...line, unit_price_minor: 0 }).success).toBe(true);
  });

  it("requires a description", () => {
    expect(orderItemSchema.safeParse({ ...line, description: "  " }).success).toBe(false);
  });

  it("accepts a line with neither product nor service id", () => {
    // Free-text lines are legitimate.
    const r = orderItemSchema.safeParse({ ...line, product_id: "", service_id: "" });
    expect(r.success).toBe(true);
  });
});

describe("createOrderSchema", () => {
  const valid = {
    customer_id: "3b83b158-8316-43aa-8eca-2adc841d821d",
    items: [{ description: "Thing", quantity: 1, unit_price_minor: 100 }],
  };

  it("accepts a minimal valid order", () => {
    expect(createOrderSchema.safeParse(valid).success).toBe(true);
  });

  it("defaults status to pending", () => {
    const r = createOrderSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.status).toBe("pending");
  });

  it("rejects an order with no lines", () => {
    // An order with nothing on it is not an order.
    expect(createOrderSchema.safeParse({ ...valid, items: [] }).success).toBe(false);
  });

  it("rejects a customer id that is not a uuid", () => {
    expect(createOrderSchema.safeParse({ ...valid, customer_id: "not-a-uuid" }).success).toBe(false);
  });

  it("rejects an unknown status", () => {
    expect(createOrderSchema.safeParse({ ...valid, status: "refunded" }).success).toBe(false);
  });

  it("accepts every status the database allows", () => {
    for (const s of ORDER_STATUSES) {
      expect(createOrderSchema.safeParse({ ...valid, status: s.value }).success).toBe(true);
    }
  });

  it("has no total field for a client to fill in", () => {
    // The total is a generated column. If this ever starts failing, someone
    // has added a client-supplied total and reopened price tampering.
    const shape = Object.keys(createOrderSchema.shape);
    expect(shape).not.toContain("total");
    expect(shape).not.toContain("total_minor");
    expect(shape).not.toContain("order_number");
  });
});
