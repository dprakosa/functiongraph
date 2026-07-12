import type { ReactNode } from "react";
import { RouteLink } from "../../routing/RouteLink";
import { Wordmark } from "../../components/shell/Sidebar";
import { AmbientGraph } from "./AmbientGraph";

const steps = [
  {
    number: "01",
    title: "Add what you own",
    body: "Keep a simple inventory of the everyday items already doing useful work in your home.",
  },
  {
    number: "02",
    title: "Check a product",
    body: "Paste a product name or listing and Subgraph breaks down what it can actually do.",
  },
  {
    number: "03",
    title: "See what is new",
    body: "Review which uses you already have covered and which ones the purchase would add.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-20 md:px-6 md:py-28"
      aria-labelledby="flow-title"
    >
      <div className="grid gap-2">
        <p className="m-0 text-[13px] font-semibold text-accent">One decision loop</p>
        <h2
          id="flow-title"
          className="m-0 text-3xl font-semibold tracking-tight text-ink"
        >
          From what you own to a clearer decision.
        </h2>
      </div>
      <ol className="m-0 mt-8 grid list-none gap-4 p-0 md:grid-cols-3">
        {steps.map((step) => (
          <li
            key={step.number}
            className="grid content-start gap-3 rounded-panel border border-hairline bg-white p-6 shadow-xs"
          >
            <span
              aria-hidden="true"
              className="text-metric grid h-8 w-8 place-items-center rounded-control bg-accent-soft text-[13px] font-bold text-accent"
            >
              {step.number}
            </span>
            <h3 className="m-0 text-base font-semibold tracking-tight text-ink">
              {step.title}
            </h3>
            <p className="m-0 text-[13px] leading-relaxed text-body">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function BentoTile({
  title,
  body,
  visual,
  className = "",
}: {
  title: string;
  body: string;
  visual?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`grid content-start gap-2 overflow-hidden rounded-hero border border-hairline bg-white p-6 shadow-xs ${className}`}
    >
      {visual}
      <h3 className="m-0 text-[15px] font-semibold tracking-tight text-ink">{title}</h3>
      <p className="m-0 text-[13px] leading-relaxed text-body">{body}</p>
    </div>
  );
}

export function BentoGrid() {
  return (
    <section
      id="features"
      className="w-full scroll-mt-20 bg-shell py-20 md:py-28"
      aria-labelledby="features-title"
    >
      <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
        <div className="grid gap-2">
          <p className="m-0 text-[13px] font-semibold text-accent">
            Built around your inventory
          </p>
          <h2
            id="features-title"
            className="m-0 text-3xl font-semibold tracking-tight text-ink"
          >
            Everything traces back to the graph.
          </h2>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <BentoTile
            className="md:col-span-2 md:row-span-3"
            visual={
              <div className="-mx-6 -mt-6 mb-2 h-64 border-b border-hairline-soft bg-white md:h-80">
                <AmbientGraph />
              </div>
            }
            title="See how your household items connect"
            body="Rooms, items, and the jobs they do are arranged in one interactive map. Every result links back to the item that already covers it."
          />
          <BentoTile
            visual={
              <div className="mb-1 flex flex-wrap gap-1.5" aria-hidden="true">
                <span className="rounded-full bg-hairline-soft px-2.5 py-1 text-[11px] text-body">bakes food</span>
                <span className="rounded-full bg-hairline-soft px-2.5 py-1 text-[11px] text-body">reheats leftovers</span>
                <span className="rounded-full border border-new/25 bg-new-soft px-2.5 py-1 text-[11px] font-medium text-new-text">air-crisps food</span>
              </div>
            }
            title="A practical feature checklist"
            body="A product listing becomes a short list of concrete, everyday uses you can compare at a glance."
          />
          <BentoTile
            visual={
              <p className="text-metric m-0 text-3xl font-semibold tracking-tight text-ink" aria-hidden="true">
                Mostly covered
              </p>
            }
            title="A verdict you can understand"
            body="See whether a product mostly repeats what you own, adds something useful, or fills a real gap."
          />
          <BentoTile
            visual={
              <p className="m-0 text-[13px] text-body" aria-hidden="true">
                <span className="font-semibold text-ink">Alternative:</span> a secondhand
                roasting pan (about $20) adds large-meal roasting.
              </p>
            }
            title="Simpler alternatives"
            body="When you only need one missing feature, Subgraph can suggest a more direct way to get it."
          />
        </div>
      </div>
    </section>
  );
}

export function PrivacySection() {
  return (
    <section
      id="privacy"
      className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-20 md:px-6 md:py-28"
      aria-labelledby="privacy-title"
    >
      <div className="grid items-start gap-8 md:grid-cols-2">
        <div className="grid gap-2">
          <p className="m-0 text-[13px] font-semibold text-accent">
            Private by construction
          </p>
          <h2
            id="privacy-title"
            className="m-0 text-3xl font-semibold tracking-tight text-ink"
          >
            The photo is temporary. Your inventory is yours.
          </h2>
        </div>
        <div className="grid gap-4 text-[15px] leading-relaxed text-body">
          <p className="m-0">
            Photos and review details are discarded after the scan flow. Only
            items you confirm are saved, and they belong to your signed-in
            account. Exploring before signing in never creates an inventory.
          </p>
          <p className="m-0">
            You can explore with a starter household inventory before creating
            an account. Sign in when you are ready to use your own items.
          </p>
        </div>
      </div>
    </section>
  );
}

const FAQS = [
  {
    question: "Do you see what I'm shopping for?",
    answer:
      "A product check sends only the product text you paste, compares it with your inventory, and returns the result. Your household photos are handled separately and discarded after review.",
  },
  {
    question: "What happens to my photos?",
    answer:
      "Photos exist only for the scan flow. They are discarded after review — only the items you explicitly confirm are saved to your account.",
  },
  {
    question: "Does it work without an account?",
    answer:
      "Yes. You can explore with a starter household inventory. Sign in when you want to build and keep your own inventory.",
  },
  {
    question: "What does the coverage score mean?",
    answer:
      "It shows how much of a product's main purpose is already handled by items in your inventory. Open the checklist to see exactly which item covers each use.",
  },
];

export function Faq() {
  return (
    <section
      id="faq"
      className="mx-auto w-full max-w-2xl scroll-mt-20 px-4 py-20 md:px-6 md:py-28"
      aria-labelledby="faq-title"
    >
      <h2
        id="faq-title"
        className="m-0 text-center text-3xl font-semibold tracking-tight text-ink"
      >
        Questions, answered.
      </h2>
      <div className="mt-8 grid gap-2">
        {FAQS.map((faq) => (
          <details
            key={faq.question}
            className="group rounded-card border border-hairline bg-white px-5 py-4 shadow-xs"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-medium text-ink [&::-webkit-details-marker]:hidden">
              {faq.question}
              <span
                aria-hidden="true"
                className="text-lg text-faint transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="m-0 mt-3 text-[13.5px] leading-relaxed text-body">
              {faq.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-20 md:px-6 md:pb-28">
      <div className="relative overflow-hidden rounded-hero border border-hairline px-6 py-16 text-center shadow-xs md:py-20">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(60% 90% at 20% 0%, rgb(91 91 214 / 0.10), transparent 60%), radial-gradient(50% 80% at 85% 10%, rgb(5 150 105 / 0.08), transparent 55%), linear-gradient(#ffffff, #fafafa)",
          }}
        />
        <h2 className="m-0 text-3xl font-semibold tracking-tight text-ink">
          Thinking about buying something?
        </h2>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-body">
          Compare it with what you already own and see what it would really add
          in seconds.
        </p>
        <RouteLink
          to="/graph"
          className="mt-6 inline-block rounded-control bg-accent px-5 py-3 text-[15px] font-semibold text-white no-underline shadow-float transition-colors hover:bg-accent-hover active:bg-accent-pressed"
        >
          Check a product against what you own
        </RouteLink>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-hairline bg-wash">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1.4fr_1fr_1fr] md:px-6">
        <div className="grid content-start justify-items-start gap-3">
          <Wordmark />
          <p className="m-0 max-w-xs text-[13px] leading-relaxed text-muted">
            See what a purchase adds — not what it repeats. Compare before you
            buy.
          </p>
        </div>
        <nav className="grid content-start gap-2" aria-label="Product">
          <span className="text-[11px] font-semibold tracking-wide text-muted uppercase">
            Product
          </span>
          <RouteLink to="/graph" className="w-fit text-[13px] text-body no-underline hover:text-ink">
            Evaluate a purchase
          </RouteLink>
          <RouteLink to="/inventory" className="w-fit text-[13px] text-body no-underline hover:text-ink">
            Your inventory
          </RouteLink>
          <RouteLink to="/history" className="w-fit text-[13px] text-body no-underline hover:text-ink">
            Decision history
          </RouteLink>
        </nav>
        <nav className="grid content-start gap-2" aria-label="Resources">
          <span className="text-[11px] font-semibold tracking-wide text-muted uppercase">
            Resources
          </span>
          <a href="#how-it-works" className="w-fit text-[13px] text-body no-underline hover:text-ink">
            How it works
          </a>
          <a href="#privacy" className="w-fit text-[13px] text-body no-underline hover:text-ink">
            Privacy
          </a>
          <a href="#faq" className="w-fit text-[13px] text-body no-underline hover:text-ink">
            FAQ
          </a>
        </nav>
      </div>
      <div className="border-t border-hairline-soft">
        <p className="mx-auto m-0 w-full max-w-6xl px-4 py-4 text-[11px] text-faint md:px-6">
          Your confirmed inventory belongs to your account
        </p>
      </div>
    </footer>
  );
}
