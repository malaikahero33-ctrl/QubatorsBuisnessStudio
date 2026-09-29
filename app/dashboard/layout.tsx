import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/lib/auth/actions";
import { isSupabaseConfigured } from "@/lib/config";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Dashboard navigation, following PRD section 8.
 *
 * The active-business model from the PRD is not built yet, so every business
 * link is marked for that phase rather than pointing at a 404.
 */
type NavItem = {
  href: string;
  label: string;
  /** Route is declared in the PRD but not built yet. Rendered disabled. */
  soon?: boolean;
};

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard" }],
  },
  {
    group: "My business",
    items: [
      { href: "/dashboard", label: "Overview" },
      { href: "/business/new", label: "Create business" },
      { href: "/business/plan", label: "Business plan", soon: true },
      { href: "/business/brand", label: "Brand", soon: true },
      { href: "/business/products", label: "Products" },
      { href: "/business/services", label: "Services", soon: true },
    ],
  },
  {
    group: "AI studio",
    items: [
      { href: "/ai/copilot", label: "Copilot", soon: true },
      { href: "/ai/ideas", label: "Idea generator", soon: true },
    ],
  },
  {
    group: "Growth",
    items: [
      { href: "/customers", label: "Customers" },
      { href: "/orders", label: "Orders" },
      { href: "/finance", label: "Finance", soon: true },
      { href: "/analytics", label: "Analytics", soon: true },
      { href: "/tasks", label: "Tasks", soon: true },
    ],
  },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) {
    redirect("/setup");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="grid min-h-screen md:grid-cols-[248px_1fr]">
      <aside className="hidden flex-col gap-1 border-r border-border bg-surface p-4 md:flex">
        <Link href="/dashboard" className="mb-6 flex items-center gap-2.5 px-2">
          <span className="grid h-9 w-9 place-content-center rounded-lg bg-brand text-base font-extrabold text-white">
            Q
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold">Qubators</p>
            <p className="text-[11px] text-muted">Business Studio</p>
          </div>
        </Link>

        <nav className="flex-1">
          {NAV.map((section) => (
            <div key={section.group} className="mb-4">
              <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted">
                {section.group}
              </p>
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.soon ? "#" : item.href}
                  aria-disabled={item.soon}
                  title={item.soon ? "Coming in a later phase" : undefined}
                  className={`block rounded-lg px-2.5 py-2 text-sm transition-colors ${
                    item.soon
                      ? "cursor-not-allowed text-muted/60"
                      : "text-foreground hover:bg-surface-2"
                  }`}
                >
                  {item.label}
                  {item.soon && (
                    <span className="ml-1.5 text-[10px] font-semibold uppercase text-muted/70">
                      soon
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t border-border pt-3">
          <p className="truncate px-2 text-xs text-muted">{user.email}</p>
          <div className="mt-2 flex items-center justify-between gap-2 px-2">
            <ThemeToggle />
            <form action={signOutAction}>
              <button type="submit" className="text-xs font-semibold text-muted hover:text-foreground">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Mobile bar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-content-center rounded-lg bg-brand text-sm font-extrabold text-white">
            Q
          </span>
          <span className="text-sm font-bold">Qubators</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <form action={signOutAction}>
            <button type="submit" className="text-xs font-semibold text-muted">
              Sign out
            </button>
          </form>
        </div>
      </div>

      <div className="min-w-0">{children}</div>
    </div>
  );
}
