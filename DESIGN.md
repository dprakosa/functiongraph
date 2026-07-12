# Subgraph visual implementation guide — clean light SaaS edition

## Authority and intent

This is the repository's authoritative visual implementation guide. **`PDD.md` is the highest-precedence source of truth**—that is the actual specification filename in this repository. If this guide, `README.md`, `CLAUDE.md`, code comments, or chat history conflicts with `PDD.md`, follow `PDD.md`. Do not alter normative requirement IDs, values, algorithms, state ordering, or scope through visual work. This edition supersedes the Atlassian Design System edition per the 2026-07-12 decision-log entry in `PDD.md` §14.

Subgraph is a bright, trustworthy, consumer-grade decision tool in the clean light SaaS tradition (Stripe/Notion register): white canvases, one quiet gray shell tint, hairline borders, restrained navy-tinted shadows, generous whitespace on marketing surfaces and calm density in the app. The product has two visual modes:

- **Marketing surfaces** (`/`, 404): editorial scale, soft radial gradients on the hero and final CTA only, big tight-tracked headlines, the product itself as the trust anchor.
- **Application surfaces** (`/graph`, `/inventory`, `/history`, `/settings`): a persistent sidebar shell beside a white working canvas. On the Evaluate page the graph—not a dashboard grid—is the protagonist; chrome floats over it as blurred pills.

## Design laws

1. The live graph is the dominant surface of the Evaluate page at every viewport; supporting UI floats over it or sits in one bounded rail.
2. Verdict semantics use exactly two speaking treatments: **covered = slate gray + check icon (recedes)**; **genuinely new = emerald + sparkle icon (pops)**. Covered evidence is quiet by design—redundancy should feel settled, not alarming.
3. **Indigo (`--color-accent`) is interaction chrome only**: primary buttons, links, focus rings, selection, the coverage ring, and the row-pulse highlight. It never communicates verdict state.
4. Amber is reserved for the "mostly covered" recommendation badge (and the pre-existing home-level hotspot badges). Everything else is neutral.
5. Verdict state is never colour-alone: covered/new pair colour with icon (check / sparkle), text (`not owned — new`), and in the graph with weight, opacity, and dash (triple encoding).
6. The ghost is the only glowing node and the only dashed+glowing node (accent-tinted: it is the object under consideration, not evidence). The transient edge pulse required by VIS-4 is the only non-node exception and lasts no longer than two seconds.
7. Every visible claim is inspectable: verdict rows and graph edges come from the same verdict data.
8. Motion represents computation or direct interaction; it is never decorative. (The landing page's ambient graph is explicit brand art, is `aria-hidden`, pauses off-screen, and freezes under reduced motion.)
9. The interface is decision support, not a blocker. Preserve both decision paths and the designed approval state.
10. Never hardcode a colour, radius, or shadow in component code. Consume the `@theme` tokens below (as Tailwind utilities or `var(--color-*)` in `src/styles/graph.css`).

## Tokens

Tokens are defined in the `@theme` block of `src/styles/index.css` (Tailwind CSS v4). They emit `--color-*`, `--radius-*`, `--shadow-*`, and `--animate-*` custom properties and drive the generated utilities (`bg-accent`, `text-covered-text`, `rounded-card`, `shadow-float`, …). `src/styles/graph.css` additionally binds the legacy graph variable names (`--covered`, `--new`, `--item-node`, `--edge-inventory`, `--ghost-glow`, …) to these tokens via the `:root` bridge in `index.css` so the D3 styling stays token-pure.

| Token | Value | Role |
|---|---|---|
| `--color-covered` / `-soft` / `-text` | slate `#64748b` / `#f1f5f9` / `#475569` | Covered/redundant evidence (recedes) |
| `--color-new` / `-soft` / `-text` | emerald `#059669` / `#ecfdf5` / `#047857` | Genuinely-new evidence (pops) |
| `--color-accent` / `-hover` / `-pressed` / `-soft` | indigo `#5b5bd6` ramp | Interaction chrome only |
| `--color-amber` / `-soft` / `-text` | `#d97706` ramp | "Mostly covered" recommendation badge |
| `--color-ink` | `#0f172a` | Headings, primary text |
| `--color-body` / `--color-muted` / `--color-faint` | `#4b5563` / `#6b7280` / `#9ca3af` | Supporting text ramp |
| `--color-shell` | `#f7f7f8` | Sidebar / marketing band tint |
| `--color-canvas` / `--color-wash` | `#ffffff` / `#fafafa` | Working canvas / sunken cards |
| `--color-hairline` / `-soft` | `#e5e7eb` / `#f3f4f6` | Borders (border-first chrome) |
| `--color-item-node*` | indigo-tinted `#eef2ff` ramp | Structural item cue (cool) — never verdict |
| `--color-capability-node*` | stone `#fafaf9` ramp | Structural capability cue (warm-neutral) — never verdict |
| `--color-ghost*` | soft violet `#8583e0` ramp | The considered product (provisional) |
| `--radius-chip/control/card/panel/hero` | 6/8/12/16/24px | Radius scale (chips → marketing tiles) |
| `--shadow-xs/float/overlay/frame` | navy-tinted stacks | Border-first in-app; shadows only for floating/overlay/marketing-frame surfaces |

Do not introduce additional speaking colours (no red/danger ramps for banners—errors stay neutral so nothing competes with the verdict encoding; no purple/cyan/pink accents).

## Typography, shape, and density

- Font: **Inter Variable** (self-hosted via `@fontsource-variable/inter`), `font-feature-settings: "cv11", "ss01"`, antialiased. System fallbacks per `--font-sans`.
- Headings are ink (`--color-ink`), weight 600, `tracking-tight` (hero: `md:tracking-tighter`). Size carries hierarchy, not weight: marketing hero 36–60px, section titles 30px, app page titles 24px, panel titles 15–16px.
- Working text: 13px default in the app (11–12px for labels/eyebrows), 15–16px on marketing surfaces. Supporting copy uses the muted ramp; never solve hierarchy with new colours.
- All prices, percentages, scores, and counts use `tabular-nums` (the `text-metric` utility or inline `font-variant-numeric`).
- Sentence case everywhere; the fixed vocabulary and copy strings in `src/lib/copy.ts` (CNT-1..6) are normative and must not be rephrased.
- Chrome is border-first: cards are `border border-hairline` + `shadow-xs` at most. Shadows above `xs` belong only to floating elements (toasts, tooltips, command palette, drawers) and the marketing product frame (`--shadow-frame`).
- Marketing sections breathe: 80–112px vertical rhythm, content at `max-w-6xl` (hero copy `max-w-3xl`).

## Application composition

### App shell (`src/components/shell/`)

`AppShell` wraps `/graph`, `/inventory`, `/history`, `/settings` (wired in `RootRouter`): a 256px sidebar (collapsible to a 64px icon rail; preference in localStorage) on `--color-shell` with no hard border tricks beyond one hairline, beside a white canvas. Sidebar order: wordmark, primary **Check a product** button (the only accent block in the sidebar), nav (Evaluate, Inventory, History, Settings) with `aria-current="page"`, spacer, account status card pinned at the bottom. Below 768px the sidebar becomes a top bar plus a slide-over drawer (Escape closes, focus managed).

Auth state (guest / loading / signed-out / signed-in) renders through `AuthStatusSlot` (`src/auth/AuthShell.tsx`): AuthShell selects the status block once, and the shell (or Settings page) mounts it. All four `data-auth-state` variants must stay reachable and keep their exact copy.

### Landing surface (`src/pages/LandingPage.tsx` + `src/pages/landing/`)

Section sequence: sticky blur nav (border appears on scroll) → hero (eyebrow chip, headline, sub, primary `Open the graph` + ghost anchor, soft radial gradient fading to white) → static product frame (hand-built mock of graph + verdict, `--shadow-frame`; deliberately **not** a live GraphCanvas) → how-it-works 3-card row → bento feature grid on `--color-shell` (large tile hosts the ambient D3 brand-art graph) → privacy section (the real ephemeral-photo / account-scoped story; **no fabricated testimonials, ratings, or aggregate savings claims**) → FAQ (`<details>` accordion) → final CTA gradient panel → footer on `--color-wash`.

### Evaluate surface (`src/App.tsx` + `src/components/evaluate/`)

- Top bar inside the canvas column: page title, inventory status + reserved photo action (`#photo-action-slot`), the command bar, inline error banner, and the capability chip stream during choreography.
- Command bar (`ProductCommandBar`): search-glyph input styled as a command field, ⌘K/Ctrl-K focuses it, integrated accent submit, the three exact demo chips (`Convection countertop oven — $129`, `4th USB-C cable — $15`, `Mini camera drone — $89`) always visible. Errors are friendly inline text; no spinner (results are fetched before choreography starts).
- Graph canvas: full-bleed, dotted `--canvas-dot` background, all remaining viewport. Chrome floats as blurred pills: view label + back control (top-left), legend (top-right), hint pill (bottom-centre), route/notice toasts. Never wrap the graph in a dashboard grid.
- Contextual rail: one at a time (verdict, item inspector; photo review later), 380px on ≥1024px with `border-l`, independent scroll, `--animate-panel-in` entrance; below 1024px it stacks under a fixed-height canvas.

### Verdict rail (`VerdictPanel`)

Order: product name + price → recommendation badge (emerald `copy.approval` when nothing is covered; amber "Mostly covered…" at ≥50% coverage, neutral otherwise) → coverage card (96px accent donut `CoverageRing` beside the exact `X of Y covered` and `N % of this, you already own` lines) → 2-up stat cards (genuinely-new count, price per new capability) → capability checklist grouped **Already covered (n)** / **New to you (n)** (grouping is presentational; row order within groups preserved) → delta economics + alternative suggestion card → sticky action footer (`Skip this purchase` accent primary, `I still need it` ghost revealing the reason form → `Buy anyway`).

Rows keep their contract: semantic buttons, `aria-pressed`, accessible name `"{capability}: {source}. Highlight its graph edge"`, activation pulses exactly the edge with the matching ID:

```ts
ghost->${capSlug}
e:${itemId}->${capSlug}
```

On Skip and Buy-anyway, the decision is appended to localStorage (`src/state/decisionStore.ts`, key `functiongraph:decisions:v1`) for the History page. Decisions never leave the device.

### Inventory, History, Settings pages

- **Inventory** (`src/pages/InventoryPage.tsx`): items grouped by room in hairline card lists; capability chips per item; signed-in accounts get inline edit (name/room/quantity via the existing PATCH endpoint) and confirm-by-name delete, refreshing through the inventory hook's `retry()`. Guests see the bundled home read-only with an explainer. All five inventory states (guest/loading/error/empty/populated) stay visually explicit; the disabled "Add from photo — coming next" affordance remains.
- **History** (`src/pages/HistoryPage.tsx`): stat cards ($ kept, decision count, kg avoided via `KG_PER_DOLLAR`) above the decision list (product, price, date, coverage, Skipped/Bought-anyway badge, reason). Empty state routes to Evaluate.
- **Settings** (`src/pages/SettingsPage.tsx`): account (AuthStatusSlot), local-data section (clear history with inline confirm + count), about.

## Graph workspace

The force-directed canvas rules from the previous edition remain in force: home and room views are data swaps and camera moves on one canvas; keep drag, zoom, pan, room navigation, and force behaviour intact; never hardcode positions or domain membership; reheat only for structural change, never for hover/selection/pulse.

Node taxonomy under the new palette (all styling in `src/styles/graph.css`):

| Node | Treatment |
|---|---|
| Room | White circle, `--border-strong` hairline stroke, capitalised label. Winner keeps the animated neutral route ring. Hotspot badge stays amber with white text. |
| Unscanned room | Dim, dashed, on `--surface-2`. |
| Item | Cool indigo-tinted circle (`--item-node` ramp) — structural cue, never verdict. Selection swaps to `--color-accent-soft` fill + accent stroke (interaction chrome). |
| Capability hub | Stone pill (`--capability-node` ramp), lowercase label; hot hubs get the heavier stroke. Connected-to-selection hubs take the accent wash. |
| New capability hub | `--new` stroke on `--new-soft`, slightly heavier than a normal hub. No glow. |
| Ghost | Dashed `--color-ghost` circle on `--color-ghost-soft` with the only glow (`--ghost-glow`). Dashed = provisional. |
| Mini capability | Small dim dashed stone pill, revealed by item expansion. |

Edge taxonomy: inventory edges neutral and receding (primary ≈ 1.8× secondary); **covered edges slate at 1.4px/60% opacity (they recede)**; **new edges emerald at 2.4px/full opacity (they pop)**; scan lines very faint and dashed; the row-tap pulse is **accent** dash-flow with `--pulse-glow`, ≤2s (VIS-4). Do not give every edge equal contrast.

Tooltips stay single, viewport-clamped, overlay-shadowed, cosmetic-only (never mutate D3 data or restart physics), with the type-specific content and dismissal rules from `PDD.md`.

## State and motion

The reducer flow, beat order, and motion budgets are unchanged from `PDD.md` §6 (SM-1..9): `resting → extracting → scanning → routing → settling → verdict`, route toast held 600ms before camera motion, chips staggered ~320ms (`chip-in`), scan fan ≤0.9s, camera 700–900ms, settle ≤1.5s, verdict panel ~300ms (`--animate-panel-in`), pulse ≤2s (`dash-flow`). The load-bearing keyframes live in `src/styles/graph.css` (`route-ring`, `dash-flow`, `toast-in`, `chip-in`) and `src/styles/index.css` (`panel-in`, `fade-up`) — recolour them if tokens change, never retime them casually.

Under `prefers-reduced-motion`: chips appear immediately, choreography skips to the verdict, the pulse becomes a static strong accent highlight, the route ring freezes visible, the landing ambient graph renders a settled static layout, and Tailwind `motion-safe:` gates every new entrance animation.

## Responsive behaviour

- ≥1024px: graph and verdict side by side; the graph gets most width; the rail is bounded at 380px.
- <1024px: verdict/inspector stacks below a stable-height canvas; one product flow, one canvas.
- <768px: sidebar becomes top bar + drawer; example chips wrap; touch targets stay generous; every action reachable without hover.
- Landing: sections stack cleanly; the primary CTA is visible without horizontal scrolling; no separate mobile route.

## Accessibility

- Semantic HTML for inputs, buttons, notices, interactive verdict rows; keyboard operability everywhere with the visible accent focus ring (`:focus-visible` outline).
- Covered vs new never relies on colour alone (icons + text + weight/dash in the graph). Slate-vs-emerald also survives red-green colour blindness by luminance.
- Live regions: route/notice toasts, inventory status, item-selection status (`sr-only`), error banners as `role="alert"`; no duplicate screen-reader chatter.
- Route changes focus the destination `[data-route-heading]` (RootRouter behaviour) — every page's `h1` carries it.
- Reduced motion is honoured without removing functionality or inspectability.

## Do / do not

### Do

- Keep the graph the protagonist of Evaluate and the shell a quiet frame.
- Bind every colour/radius/shadow to the `@theme` tokens; extend the token block rather than inlining values.
- Keep covered evidence quiet (slate + check) and new evidence loud (emerald + sparkle); keep indigo strictly interactional.
- Pair every floating surface with `--shadow-float`/`--shadow-overlay`; keep resting cards border-first.
- Preserve force-driven emergence, edge inspectability, the offline demo arcs, the approval state, and both decision actions.
- Keep guest/loading/empty/error/populated inventory states visually explicit; keep photos and review data ephemeral.
- Keep marketing content honest: real product behaviour and the real privacy story only — no invented social proof or statistics.
- Verify desktop, mobile, keyboard, reduced-motion, simulation cooling, and every row-to-edge mapping after visual changes.

### Do not

- Do not add speaking colours beyond the covered/new pair (plus the restricted amber badge); do not use red/danger ramps for errors.
- Do not restyle the ghost's glow onto anything else, or add idle node motion.
- Do not turn the Evaluate surface into a dashboard grid, or let floating chrome obscure the graph.
- Do not hardcode positions, domains, scores, percentages, or demo-only visual outcomes.
- Do not reheat physics for hover, highlighting, selection, or edge pulse.
- Do not rephrase `copy.ts` strings, alter demo chip labels, or change the edge/row ID contracts.
- Do not persist decisions, raw images, provider output, confidence, evidence, warnings, or review drafts to the server.
