/**
 * Ledger summarisation.
 *
 * Pure functions over transaction rows. No database, no React — which is the
 * point: the arithmetic that decides whether someone is making money can be
 * tested without standing anything up.
 *
 * The invariant that shapes all of this: `type` carries the direction and
 * `amount_minor` is always positive. There is no negative income. That is why
 * `netMinor` is `income - expense` and never a `reduce` with `+= amount`
 * — a plain sum would add an expense as if it were income.
 *
 * Months are bucketed in UTC, not the viewer's local time. Server and client
 * must agree or React reports a hydration mismatch, and a business owner whose
 * dashboard disagrees with itself is worse than one that is a few hours out on
 * a month boundary.
 */

export type LedgerEntry = {
  type: "income" | "expense";
  amount_minor: number;
  category: string | null;
  occurred_at: string;
};

export type MonthSummary = {
  /** "2026-09" — sortable and unambiguous. */
  month: string;
  /** "Sep 2026" — for display only. */
  label: string;
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
  count: number;
};

export type CategorySummary = {
  category: string;
  amountMinor: number;
  /** 0–1 of total expenses. 0 when there are no expenses at all. */
  share: number;
};

export type LedgerSummary = {
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
  count: number;
  /** Newest first. */
  months: MonthSummary[];
  /** Largest first. Only expenses: a "spend breakdown" of income is noise. */
  expensesByCategory: CategorySummary[];
  /** Margins 0–100. Null when there has been no income, because the percentage
   *  of nothing spent is not 100% profit — it is unknown. */
  marginPercent: number | null;
};

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function monthKey(iso: string): string {
  // Slice rather than parse-and-reformat: an unparseable date would throw here
  // and take the whole dashboard down, and a bad row should be skipped instead.
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  return m ? `${m[1]}-${m[2]}` : "unknown";
}

function monthLabel(key: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return "Unknown date";
  const index = Number(m[2]) - 1;
  return MONTH_LABELS[index] ? `${MONTH_LABELS[index]} ${m[1]}` : key;
}

/**
 * Roll a set of entries up into totals, a month-by-month series and a spend
 * breakdown.
 *
 * Entries with a non-positive or non-integer amount are ignored rather than
 * thrown, because the database constrains them but this function must not be
 * the thing that crashes a page if that constraint is ever loosened.
 */
export function summariseLedger(entries: LedgerEntry[]): LedgerSummary {
  const byMonth = new Map<string, MonthSummary>();

  let incomeMinor = 0;
  let expenseMinor = 0;
  let count = 0;

  const categoryTotals = new Map<string, number>();

  for (const entry of entries) {
    const amount = entry.amount_minor;
    if (!Number.isInteger(amount) || amount <= 0) continue;

    count += 1;
    const key = monthKey(entry.occurred_at);
    let bucket = byMonth.get(key);
    if (!bucket) {
      bucket = {
        month: key,
        label: monthLabel(key),
        incomeMinor: 0,
        expenseMinor: 0,
        netMinor: 0,
        count: 0,
      };
      byMonth.set(key, bucket);
    }

    bucket.count += 1;

    if (entry.type === "income") {
      incomeMinor += amount;
      bucket.incomeMinor += amount;
    } else {
      expenseMinor += amount;
      bucket.expenseMinor += amount;
      const name = (entry.category ?? "").trim() || "Uncategorised";
      categoryTotals.set(name, (categoryTotals.get(name) ?? 0) + amount);
    }
  }

  for (const bucket of byMonth.values()) {
    bucket.netMinor = bucket.incomeMinor - bucket.expenseMinor;
  }

  const months = [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month));

  const expensesByCategory = [...categoryTotals.entries()]
    .map(([category, amountMinor]) => ({
      category,
      amountMinor,
      share: expenseMinor === 0 ? 0 : amountMinor / expenseMinor,
    }))
    .sort((a, b) => b.amountMinor - a.amountMinor);

  return {
    incomeMinor,
    expenseMinor,
    netMinor: incomeMinor - expenseMinor,
    count,
    months,
    expensesByCategory,
    marginPercent: incomeMinor === 0 ? null : ((incomeMinor - expenseMinor) / incomeMinor) * 100,
  };
}

/** Categories offered when recording an expense. Free text is still allowed. */
export const EXPENSE_CATEGORIES = [
  "Ingredients and materials",
  "Rent",
  "Transport and fuel",
  "Salaries",
  "Utilities",
  "Marketing",
  "Packaging",
  "Equipment",
  "Licences and permits",
  "Phone and internet",
  "Bank charges",
  "Repairs",
  "Other",
] as const;

export const INCOME_CATEGORIES = [
  "Order payment",
  "Cash sale",
  "Mobile money",
  "Bank transfer",
  "Wholesale",
  "Service fee",
  "Grant",
  "Loan received",
  "Other",
] as const;

