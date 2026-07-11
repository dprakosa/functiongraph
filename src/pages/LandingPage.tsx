import { RouteLink } from "../routing/RouteLink";

const steps = [
  {
    number: "01",
    title: "Capture what you own",
    body: "Build an account-scoped inventory from the objects already doing useful work in your home.",
  },
  {
    number: "02",
    title: "Map a product",
    body: "Turn a listing into capabilities, then compare them against the same inventory your graph shows.",
  },
  {
    number: "03",
    title: "Inspect the genuine delta",
    body: "See what is covered, what is truly new, and the cost of each capability the purchase would add.",
  },
];

export function LandingPage() {
  return (
    <main className="landing-page" aria-labelledby="landing-title">
      <header className="landing-masthead">
        <RouteLink className="wordmark" to="/" aria-label="FunctionGraph home">
          <span className="wordmark__mark" aria-hidden="true">FG</span>
          <span>FunctionGraph</span>
        </RouteLink>
        <RouteLink className="text-link" to="/graph">
          Knowledge graph <span aria-hidden="true">→</span>
        </RouteLink>
      </header>

      <section className="landing-hero">
        <div>
          <p className="eyebrow">Capability-level purchase decisions</p>
          <h1 id="landing-title" data-route-heading tabIndex={-1}>
            See what a purchase adds—not what it repeats.
          </h1>
        </div>
        <div className="landing-hero__action">
          <p>
            FunctionGraph maps a product against what you already own, so the
            genuinely new functions stay visible before you spend.
          </p>
          <RouteLink className="route-cta" to="/graph">
            Open the graph <span aria-hidden="true">→</span>
          </RouteLink>
          <small>
            No account required: guest mode includes a 36-item home and three
            examples that run fully offline.
          </small>
        </div>
      </section>

      <section className="landing-flow" aria-labelledby="flow-title">
        <div className="landing-section-heading">
          <p className="eyebrow">One decision loop</p>
          <h2 id="flow-title">From ownership to a useful yes or no.</h2>
        </div>
        <ol>
          {steps.map((step) => (
            <li key={step.number}>
              <span className="landing-flow__number" aria-hidden="true">
                {step.number}
              </span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <aside className="landing-privacy" aria-labelledby="privacy-title">
        <div>
          <p className="eyebrow">Private by construction</p>
          <h2 id="privacy-title">The photo is temporary. Your inventory is yours.</h2>
        </div>
        <p>
          Photos and review details are discarded after the scan flow. Only
          items you confirm are saved, and they belong to your signed-in account.
          Guest exploration never creates an inventory.
        </p>
      </aside>

      <footer className="landing-footer">
        <span>FunctionGraph</span>
        <span>Map the capability delta before you buy.</span>
        <RouteLink to="/graph">Open guest demo</RouteLink>
      </footer>
    </main>
  );
}
