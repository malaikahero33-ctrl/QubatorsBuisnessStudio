import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/config";

const JOURNEY = [
  { step: "01", title: "Describe your idea", body: "Plain language. No template to fight." },
  { step: "02", title: "Get a real analysis", body: "Market, customers, competitors, risks — and what we had to assume." },
  { step: "03", title: "Build a brand", body: "Name, tagline, colours, type, guidelines you can hand to a printer." },
  { step: "04", title: "Launch and sell", body: "Products, pricing, customers, orders, money in and out." },
];

export default function HomePage() {
  const ready = isSupabaseConfigured();

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-content-center rounded-lg bg-brand text-base font-extrabold text-white">
              Q
            </span>
            <span className="text-sm font-bold">Qubators Business Studio</span>
          </div>

          <h1 className="mt-8 max-w-3xl text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
            Turn your idea into a business that can run.
          </h1>

          <p className="mt-5 max-w-2xl text-lg text-muted">
            Idea, analysis, brand, products, marketing, customers, finance and analytics — in
            one workspace, built for African entrepreneurs. You arrive with an idea and leave
            with something structured, branded and ready to sell.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link href={ready ? "/signup" : "/setup"} className="btn btn-primary px-5 py-3">
              {ready ? "Create your business" : "Set up the app"}
            </Link>
            <Link href={ready ? "/login" : "/setup"} className="btn px-5 py-3">
              Sign in
            </Link>
          </div>

          {!ready && (
            <p className="mt-4 text-sm text-muted">
              Supabase is not connected yet, so accounts are switched off.{" "}
              <Link href="/setup" className="text-brand underline">
                Four steps to connect
              </Link>
              .
            </p>
          )}
        </div>
      </section>

      {/* Journey */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted">
          How it works
        </h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {JOURNEY.map((item) => (
            <li key={item.step} className="rounded-xl border border-border bg-surface p-5">
              <span className="font-mono text-xs font-bold text-brand">{item.step}</span>
              <h3 className="mt-2 font-bold">{item.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{item.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Honesty about the AI */}
      <section className="border-y border-border bg-surface-2">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-2xl font-bold tracking-tight">
            The AI tells you what it does not know.
          </h2>
          <div className="mt-4 grid gap-6 text-sm md:grid-cols-3">
            <div>
              <h3 className="font-bold">It states its assumptions</h3>
              <p className="mt-1.5 text-muted">
                Every answer lists what it inferred because you did not tell it. You can see the
                reasoning gaps before they cost you money.
              </p>
            </div>
            <div>
              <h3 className="font-bold">It never guarantees profit</h3>
              <p className="mt-1.5 text-muted">
                Ranges and conditions, not promises. Revenue projections are shown as scenarios to
                test, not forecasts to trust.
              </p>
            </div>
            <div>
              <h3 className="font-bold">It separates fact from suggestion</h3>
              <p className="mt-1.5 text-muted">
                Market research you supply is marked as verified. Anything the model produces is
                marked as a suggestion. The two are never mixed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-2xl font-bold tracking-tight">What is inside</h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            "Business Copilot that knows your business",
            "Idea generator and validation",
            "16-section business plan, exportable",
            "Brand studio with colours and type",
            "Products and services with pricing",
            "Pricing assistant with real margins",
            "Marketing copy for every channel",
            "Customer management and order tracking",
            "Finance: income, expenses, profit, cash flow",
            "Tasks and an AI roadmap",
            "Analytics across sales, finance, marketing",
            "Multi-business workspace",
          ].map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm">
              <span className="mt-0.5 grid h-4 w-4 flex-none place-content-center rounded-full bg-brand-soft text-[10px] font-bold text-brand-ink">
                ✓
              </span>
              {feature}
            </li>
          ))}
        </ul>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-8 text-xs text-muted">
          <span>© {new Date().getFullYear()} Qubators</span>
          <span>Built for Uganda, designed for everywhere.</span>
        </div>
      </footer>
    </main>
  );
}
