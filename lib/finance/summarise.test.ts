import { describe, expect, it } from "vitest";
import { summariseLedger, type LedgerEntry } from "./summarise";

const NOW = "2026-09-15T09:00:00.000Z";
const at = (month: string, day = "15") => `${month}-${day}T09:00:00.000Z`;

const income = (
  amount_minor: number,
  occurred_at: string,
  category: string | null = null,
): LedgerEntry => ({ type: "income", amount_minor, category, occurred_at });

const expense = (
  amount_minor: number,
  occurred_at: string,
  category: string | null = null,
): LedgerEntry => ({ type: "expense", amount_minor, category, occurred_at });

describe("summariseLedger", () => {
  it("returns zeroes for an empty ledger rather than throwing", () => {
    const s = summariseLedger([]);
    expect(s.incomeMinor).toBe(0);
    expect(s.expenseMinor).toBe(0);
    expect(s.netMinor).toBe(0);
    expect(s.count).toBe(0);
    expect(s.months).toEqual([]);
  });

  it("subtracts expenses from income", () => {
    const s = summariseLedger([income(60_000_000, NOW), expense(3_150_000, NOW)]);
    expect(s.incomeMinor).toBe(60_000_000);
    expect(s.expenseMinor).toBe(3_150_000);
    expect(s.netMinor).toBe(56_850_000);
  });

  it("goes negative when spending exceeds income", () => {
    // The common case in a business's first months. It must not be clamped.
    const s = summariseLedger([income(1_000_000, NOW), expense(1_500_000, NOW)]);
    expect(s.netMinor).toBe(-500_000);
  });

  it("does not treat an expense as income", () => {
    // The specific bug the type/amount split exists to prevent.
    const s = summariseLedger([income(100, NOW), expense(40, NOW)]);
    expect(s.incomeMinor).toBe(100);
    expect(s.expenseMinor).toBe(40);
  });

  it("groups entries into months", () => {
    const s = summariseLedger([
      income(100_000, at("2026-07")),
      income(150_000, at("2026-08")),
      expense(50_000, at("2026-08")),
    ]);
    expect(s.months).toHaveLength(2);
    const august = s.months.find((m) => m.month === "2026-08");
    expect(august?.incomeMinor).toBe(150_000);
    expect(august?.expenseMinor).toBe(50_000);
    expect(august?.netMinor).toBe(100_000);
    expect(august?.count).toBe(2);
  });

  it("orders months newest first", () => {
    const s = summariseLedger([
      income(1, at("2026-01")),
      income(1, at("2026-12")),
      income(1, at("2026-06")),
    ]);
    expect(s.months.map((m) => m.month)).toEqual(["2026-12", "2026-06", "2026-01"]);
  });

  it("labels months readably", () => {
    const s = summariseLedger([income(1, at("2026-09"))]);
    expect(s.months[0].label).toBe("Sep 2026");
  });

  it("breaks expenses down by category, largest first", () => {
    const s = summariseLedger([
      expense(100, at("2026-09"), "Rent"),
      expense(300, at("2026-09"), "Transport"),
      expense(600, at("2026-09"), "Ingredients"),
    ]);
    expect(s.expensesByCategory.map((c) => c.category)).toEqual([
      "Ingredients",
      "Transport",
      "Rent",
    ]);
  });

  it("computes category shares that sum to 1", () => {
    const s = summariseLedger([
      expense(250, at("2026-09"), "Rent"),
      expense(750, at("2026-09"), "Fuel"),
    ]);
    const total = s.expensesByCategory.reduce((sum, c) => sum + c.share, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it("excludes income from the spend breakdown", () => {
    const s = summariseLedger([income(1_000, at("2026-09"), "Order payment")]);
    expect(s.expensesByCategory).toEqual([]);
  });

  it("buckets an expense with no category as Uncategorised", () => {
    const s = summariseLedger([expense(100, at("2026-09"), null), expense(50, at("2026-09"), "   ")]);
    expect(s.expensesByCategory).toHaveLength(1);
    expect(s.expensesByCategory[0].category).toBe("Uncategorised");
    expect(s.expensesByCategory[0].amountMinor).toBe(150);
  });

  it("reports margin only when there is income", () => {
    // Percentage margin of no income is undefined, not 100%.
    expect(summariseLedger([expense(500, at("2026-09"))]).marginPercent).toBeNull();
    expect(summariseLedger([]).marginPercent).toBeNull();
    expect(
      summariseLedger([income(1000, NOW), expense(250, NOW)]).marginPercent,
    ).toBeCloseTo(75, 10);
  });

  it("skips entries that could never have come from the database", () => {
    // The CHECK constraints stop these, but the summary must not be the
    // component that takes the page down if one is ever removed.
    const s = summariseLedger([
      expense(-100, at("2026-09"), "Bad"),
      income(12.5, at("2026-09")),
      expense(0, at("2026-09")),
      income(100, at("2026-09")),
    ]);
    expect(s.count).toBe(1);
    expect(s.incomeMinor).toBe(100);
    expect(s.expenseMinor).toBe(0);
  });

  it("does not crash on an unparseable date", () => {
    const s = summariseLedger([income(100, "not-a-date")]);
    expect(s.incomeMinor).toBe(100);
    expect(s.months[0].month).toBe("unknown");
    expect(s.months[0].label).toBe("Unknown date");
  });

  it("buckets by UTC month, so a month boundary is stable", () => {
    // 23:30 UTC on the last day is the next month in Kampala (UTC+3) but must
    // stay in its own month here, or the server and client would disagree.
    const s = summariseLedger([income(100, "2026-08-31T23:30:00.000Z")]);
    expect(s.months[0].month).toBe("2026-08");
  });
});
