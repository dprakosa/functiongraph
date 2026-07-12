/**
 * Static, hand-built mock of the evaluate workspace (graph + verdict rail)
 * shown in a browser frame on the landing page. Deliberately not a live
 * GraphCanvas: this is a fixed illustration, so the landing page stays light
 * and nothing here can drift from real scoring output — it is presented as
 * an illustration, not as computed results.
 */
export function ProductFrame() {
  return (
    <div className="overflow-hidden rounded-panel bg-white shadow-frame">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-hairline bg-wash px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden="true">
          <i className="h-2.5 w-2.5 rounded-full bg-hairline" />
          <i className="h-2.5 w-2.5 rounded-full bg-hairline" />
          <i className="h-2.5 w-2.5 rounded-full bg-hairline" />
        </span>
        <span className="mx-auto rounded-chip bg-white px-6 py-1 text-[10px] text-faint">
          functiongraph.app/graph
        </span>
      </div>

      <div className="grid md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* Graph side */}
        <div className="relative min-h-64 border-b border-hairline md:border-r md:border-b-0">
          <svg viewBox="0 0 480 300" className="h-full w-full" aria-hidden="true">
            <defs>
              <pattern id="pf-dots" width="18" height="18" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="0.8" fill="var(--color-hairline)" />
              </pattern>
            </defs>
            <rect width="480" height="300" fill="url(#pf-dots)" />
            {/* inventory edges */}
            <g stroke="var(--color-faint)" strokeOpacity="0.45" strokeWidth="1">
              <line x1="150" y1="150" x2="240" y2="90" />
              <line x1="150" y1="150" x2="235" y2="205" />
              <line x1="240" y1="90" x2="330" y2="140" />
              <line x1="235" y1="205" x2="330" y2="140" />
            </g>
            {/* covered edges: slate, receding */}
            <g stroke="var(--color-covered)" strokeOpacity="0.6" strokeWidth="1.4">
              <line x1="360" y1="220" x2="240" y2="90" />
              <line x1="360" y1="220" x2="330" y2="140" />
            </g>
            {/* new edge: emerald, heavier */}
            <line
              x1="360"
              y1="220"
              x2="420"
              y2="130"
              stroke="var(--color-new)"
              strokeWidth="2.4"
            />
            {/* item nodes */}
            <g>
              <circle cx="150" cy="150" r="34" fill="var(--color-item-node)" stroke="var(--color-item-node-border)" strokeWidth="1.4" />
              <text x="150" y="154" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--color-item-node-text)">Air fryer</text>
              <circle cx="240" cy="90" r="28" fill="var(--color-item-node)" stroke="var(--color-item-node-border)" strokeWidth="1.4" />
              <text x="240" y="94" textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--color-item-node-text)">Toaster</text>
              <circle cx="235" cy="205" r="30" fill="var(--color-item-node)" stroke="var(--color-item-node-border)" strokeWidth="1.4" />
              <text x="235" y="209" textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--color-item-node-text)">Microwave</text>
            </g>
            {/* capability pill */}
            <g>
              <rect x="296" y="128" rx="12" ry="12" width="70" height="24" fill="var(--color-capability-node)" stroke="var(--color-capability-node-border)" />
              <text x="331" y="144" textAnchor="middle" fontSize="10" fill="var(--color-capability-node-text)">bakes food</text>
            </g>
            {/* new capability pill */}
            <g>
              <rect x="384" y="112" rx="12" ry="12" width="86" height="24" fill="var(--color-new-soft)" stroke="var(--color-new)" strokeWidth="1.4" />
              <text x="427" y="128" textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--color-new-text)">air-crisps food</text>
            </g>
            {/* ghost node */}
            <g>
              <circle cx="360" cy="220" r="42" fill="var(--color-ghost-soft)" stroke="var(--color-ghost)" strokeWidth="1.4" strokeDasharray="6 4" />
              <text x="360" y="216" textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--color-ghost-text)">Air fryer XL</text>
              <text x="360" y="230" textAnchor="middle" fontSize="9" fill="var(--color-ghost-text)">$149 · considering</text>
            </g>
          </svg>
        </div>

        {/* Verdict side */}
        <div className="grid content-start gap-3 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-semibold text-ink">Air fryer XL</span>
            <span className="text-metric text-[13px] font-semibold text-ink">$149</span>
          </div>
          <span className="flex items-center gap-1.5 rounded-control border border-amber/25 bg-amber-soft px-2.5 py-1.5 text-[11px] font-semibold text-amber-text">
            <svg viewBox="0 0 14 14" className="h-3 w-3" aria-hidden="true">
              <circle cx="5.4" cy="7" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
              <circle cx="8.6" cy="7" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
            </svg>
            Mostly covered by what you own
          </span>
          <div className="flex items-center gap-3 rounded-card border border-hairline p-2.5">
            <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
              <circle cx="28" cy="28" r="23" fill="none" stroke="var(--color-hairline-soft)" strokeWidth="6" />
              <circle
                cx="28"
                cy="28"
                r="23"
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray="101 144.5"
                transform="rotate(-90 28 28)"
              />
              <text x="28" y="32" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--color-ink)">70%</text>
            </svg>
            <div className="grid gap-0.5 text-left">
              <span className="text-metric text-xs font-semibold text-ink">7 of 10 covered</span>
              <span className="text-[10.5px] text-muted">70 % of this, you already own</span>
            </div>
          </div>
          <ul className="m-0 grid list-none gap-1 p-0 text-left">
            <li className="flex items-center gap-2 rounded-control px-2 py-1.5">
              <span className="text-covered" aria-hidden="true">✓</span>
              <span className="flex-1 text-[11.5px] text-covered-text">bakes food</span>
              <span className="text-[10px] text-faint">Toaster oven</span>
            </li>
            <li className="flex items-center gap-2 rounded-control px-2 py-1.5">
              <span className="text-covered" aria-hidden="true">✓</span>
              <span className="flex-1 text-[11.5px] text-covered-text">reheats leftovers</span>
              <span className="text-[10px] text-faint">Microwave</span>
            </li>
            <li className="flex items-center gap-2 rounded-control border border-new/20 bg-new-soft/60 px-2 py-1.5">
              <span className="text-new" aria-hidden="true">✦</span>
              <span className="flex-1 text-[11.5px] font-medium text-ink">air-crisps food</span>
              <span className="text-[10px] font-medium text-new-text">not owned — new</span>
            </li>
          </ul>
          <div className="grid grid-cols-2 gap-1.5">
            <span className="rounded-control bg-accent px-2 py-1.5 text-center text-[11px] font-semibold text-white">
              Skip this purchase
            </span>
            <span className="rounded-control border border-hairline px-2 py-1.5 text-center text-[11px] font-medium text-body">
              I still need it
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
