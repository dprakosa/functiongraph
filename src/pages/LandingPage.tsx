import { RouteLink } from "../routing/RouteLink";
import { MarketingNav } from "./landing/MarketingNav";
import { ProductFrame } from "./landing/ProductFrame";
import {
  BentoGrid,
  Faq,
  FinalCta,
  HowItWorks,
  LandingFooter,
  PrivacySection,
} from "./landing/sections";

export function LandingPage() {
  return (
    <div className="bg-white">
      <MarketingNav />
      <main aria-labelledby="landing-title">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(55% 60% at 50% -10%, rgb(91 91 214 / 0.12), transparent 65%), radial-gradient(40% 50% at 85% 5%, rgb(5 150 105 / 0.06), transparent 55%), radial-gradient(45% 55% at 12% 8%, rgb(217 119 6 / 0.05), transparent 55%), linear-gradient(#ffffff, #ffffff)",
            }}
          />
          <div className="mx-auto grid w-full max-w-6xl justify-items-center gap-6 px-4 pt-16 pb-10 text-center md:px-6 md:pt-24">
            <p className="m-0 flex items-center gap-1.5 rounded-full border border-hairline bg-white/70 px-3 py-1 text-xs font-medium text-body shadow-xs">
              <span aria-hidden="true" className="text-accent">✦</span>
              Buy with a clearer picture
            </p>
            <h1
              id="landing-title"
              data-route-heading
              tabIndex={-1}
              className="m-0 max-w-3xl text-4xl font-semibold tracking-tight text-ink outline-none md:text-6xl md:tracking-tighter"
            >
              See what a purchase adds—not what it repeats.
            </h1>
            <p className="m-0 max-w-xl text-base leading-relaxed text-body md:text-lg">
              Subgraph compares a product with what you already own, so you can
              see what is already covered and what would actually be new.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <RouteLink
                to="/graph"
                className="rounded-control bg-accent px-5 py-3 text-[15px] font-semibold text-white no-underline shadow-float transition-colors hover:bg-accent-hover active:bg-accent-pressed"
              >
                Check a product <span aria-hidden="true">→</span>
              </RouteLink>
              <a
                href="#how-it-works"
                className="rounded-control border border-hairline bg-white px-5 py-3 text-[15px] font-medium text-body no-underline shadow-xs transition-colors hover:bg-hairline-soft hover:text-ink"
              >
                See how it works
              </a>
            </div>
            <small className="text-xs text-muted">
              Explore with a ready-to-use household inventory. Sign in to use
              your own.
            </small>
          </div>

          <div className="mx-auto w-full max-w-5xl px-4 pb-20 md:px-6 md:pb-28">
            <ProductFrame />
          </div>
        </section>

        <HowItWorks />
        <BentoGrid />
        <PrivacySection />
        <Faq />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
