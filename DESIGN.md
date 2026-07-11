# FunctionGraph visual implementation guide

## Authority and intent

This is the repository's authoritative visual implementation guide. **`PDD.md` is the highest-precedence source of truth**—that is the actual specification filename in this repository. If this guide, the generated Linear reference, `README.md`, `CLAUDE.md`, `visualization-design.md`, code comments, or chat history conflicts with `PDD.md`, follow `PDD.md`. Do not alter normative requirement IDs, values, algorithms, state ordering, or scope through visual work.

FunctionGraph is a precise, bright, technical decision tool: Linear-inspired interface discipline applied to a node-editor workspace. Keep the ultra-minimal white shell, dense readable layout, light neutral surface ladder, hairline borders, compact controls, strong type hierarchy, and fast polish. On `/graph`, the graph—not a marketing page or dashboard grid—is the product and the visual centre. The approved `/` route is a compact explanation and entry point, not a replacement for the graph experience.

Neither route may resemble a generic SaaS template, a collection of unrelated cards, a colourful analytics dashboard, neon cyberpunk, glassmorphism, or a Linear issue-tracker clone. Keep the landing page restrained and specific to FunctionGraph instead of wrapping marketing sections around a live graph.

## Design laws

1. The live graph is the dominant surface at every `/graph` viewport; `/` remains a compact, graph-free landing page.
2. Exactly two colours communicate verdict state: coral means `covered`; green means `new`.
3. Amber is restricted to home-level hotspot badges. Everything else is graphite.
4. The ghost is the only node with a glow. The transient edge pulse required by VIS-4 is the only non-node exception and lasts no longer than two seconds.
5. Every visible claim is inspectable: verdict rows and graph edges come from the same verdict data.
6. Motion represents computation or direct interaction; it is never decorative.
7. The interface is decision support, not a blocker. Preserve both decision paths and the designed approval state.

## Tokens

Use CSS custom properties or map these exact values into the existing token system. Do not substitute the generated Linear palette.

```css
:root {
  color-scheme: light;

  --background: #ffffff;
  --surface-1: #ffffff;
  --surface-2: #f4f6f8;
  --surface-3: #e8edf1;

  --border-subtle: rgba(23, 33, 43, 0.09);
  --border-default: rgba(23, 33, 43, 0.16);
  --border-strong: rgba(23, 33, 43, 0.28);

  --text-primary: #17212b;
  --text-secondary: #4d5966;
  --text-muted: #75818d;

  --covered: #ff765f;
  --new: #57c785;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-7: 32px;

  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 10px;
  --radius-pill: 9999px;
}
```

The surface ladder supplies depth: background → surface 1 → surface 2 → surface 3. Use one-pixel hairlines and, at most, restrained local shadows for overlays. Do not add decorative gradients, atmospheric lighting, glass blur, large floating rounded cards, or a new chromatic focus/brand colour. Use a neutral high-contrast focus outline.

Node types may use low-chroma neutral temperature for recognition: owned items use a cool light slate, while capability pills use a warm light neutral. These are structural type cues, never verdict or status colours; coral and green retain their exclusive covered/new meanings.

Amber has no general semantic token. If an existing amber is used, confine it to the badge inside a home-level hotspot room; never use it for warnings, actions, verdicts, edges, focus, or room fills. Do not introduce blue, purple, cyan, pink, or yellow status colours. Linear lavender is not part of FunctionGraph.

## Typography, shape, and density

Use the existing sans stack where possible:

```css
font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont,
  "Segoe UI", sans-serif;
```

- Use sentence case everywhere and the fixed vocabulary in `PDD.md`.
- Prefer 12–16px working text, compact 18–24px headings, medium weights, tight but readable line heights, and restrained negative tracking only on headings.
- Use `font-variant-numeric: tabular-nums` for prices, percentages, scores, and coverage counts.
- Use `--text-secondary` and `--text-muted` for supporting copy; never solve hierarchy with many colours.
- Do not place a giant hero heading in the application.
- Use only the 4, 8, 12, 16, 20, 24, 32 spacing scale.
- Default to 6–10px radii. Reserve full pills for nodes, capabilities, statuses, and compact chips—not panels or ordinary buttons.
- Keep controls compact on desktop while preserving generous touch padding.

## Application composition

Use a route-aware shell with shared FunctionGraph branding and Clerk account state. Navigation uses ordinary `/` and `/graph` links, preserves browser Back/Forward behavior, and restores focus to the destination heading. Keep account controls compact; do not introduce a persistent dashboard navigation rail.

### Landing page (`/`)

The public landing page is a short entry point built from the existing tokens. It contains:

- a concise capability-level value proposition and primary `Open the graph` action;
- a clear explanation that guests can explore the bundled demo;
- one compact three-step sequence: capture what you own, map a product, inspect the genuinely-new delta;
- a privacy/account note: photos and review details are ephemeral, while confirmed items belong to the signed-in account;
- shared sign-in/account controls and a small footer.

Keep the content within a restrained reading width and one or two viewport lengths. Use typography, hairlines, and small grouped steps rather than a giant hero, live D3 preview, gradient, testimonial wall, pricing grid, or repeated marketing cards.

### Graph page (`/graph`)

Use one compact graph application shell without a persistent top header. It contains:

- the purchase-evaluation title and one-line explanation;
- a back control whenever the user is off home level;
- product command bar and mandatory example chips;
- a compact photo action and explicit inventory status;
- the graph workspace, route toast, and one contextual rail used by the verdict, photo review, or item inspector.

The graph occupies most of the available viewport and most desktop width. Do not surround it with a conventional dashboard grid. On desktop, place the active contextual rail beside the graph with a sensible maximum width and fit the camera to both; never replace or obscure the graph. Show only one rail mode at a time and preserve the user's graph context when it changes.

### Product command bar

Treat product entry as a precise command-bar control: compact but prominent, on a clean white surface, with a thin border, integrated submit action, visible neutral keyboard focus, and resilient wrapping for long input. Keep it vertically tight so the graph receives the majority of the viewport. Errors are friendly inline text that explains the next step; never apologize. The arrival flow has no spinner because the full result is fetched before choreography starts.

Always expose these exact one-tap demo strings, matching the demo cache:

- `Convection countertop oven — $129`
- `4th USB-C cable — $15`
- `Mini camera drone — $89`

Chips wrap or scroll horizontally rather than shrinking below legibility.

## Graph workspace

Home and room views are data swaps and camera moves on the same force-directed canvas. Keep drag, zoom, pan, room navigation, and force behaviour intact. Use a white dotted node-editor background with faint neutral dots; avoid strong grid lines and visually loud canvas controls. On desktop, the app shell fits the viewport without a document scrollbar so the graph receives the remaining height.

Never hardcode node positions or domain membership. Seed structural updates from current positions, let clusters emerge from shared capabilities, allow the simulation to cool fully, and never add idle motion. Reheat only for structural change: phase, expansion, a new result, or local drag. Hover, selection, row pulse, and other cosmetic highlights must not reheat the full simulation.

The relationship hierarchy is home room → owned item → capability. Entering a room swaps the same canvas to its item/capability graph. Owned items connect only to capability hubs or their revealed unique mini-capabilities; item-to-item edges are forbidden. Selecting an item applies a neutral emphasis to that item, every connected capability node, and their inventory edges while visibly dimming unrelated nodes and inventory edges. It must not recolour verdict semantics or reheat physics unless unique mini-capabilities are structurally revealed.

### Inventory states and empty graph

Guests see the bundled 36-item inventory and all three offline examples. Signed-in users see only their personal inventory, with distinct loading, error, empty, and populated states. Never flash guest items while account data loads and never substitute them after an error.

The empty personal state keeps the graph workspace visually stable but replaces unusable graph controls with a concise explanation and primary photo action. It tells the user that their account starts empty and that confirmed items will build the graph. Loading uses a quiet structural placeholder; errors retain a retry and an actionable hint without inventing data.

### Photo capture and review

Place one prominent but compact photo action near inventory status. It offers environment-camera capture and ordinary file upload to signed-in users; guests receive sign-in before any file picker opens. State the supported JPEG, PNG, and WebP formats and explain that HEIC is not supported in this release.

Use the contextual rail for preparation, scan status, review, and confirmation on wide screens; use an in-flow full-width sheet below the graph on narrow screens. Show a local preview while it is needed, then release it on cancel, completion, navigation, or unmount. Scanning uses plain status copy, not a fake percentage.

Review every candidate as a compact selectable row. Name, room, and quantity are editable with inline validation; detected capabilities and tiers are visible but read-only. Confidence, evidence, and warnings help review but are visually secondary and are never represented as saved fields. Keep confirm disabled until at least one selected row is valid. Saving succeeds as one transaction, refreshes the graph, announces the result, and clears the entire draft; failure preserves the review so the user can retry.

### Item inspector

Selecting a saved personal item opens the contextual rail without changing its existing neutral graph highlight. Display name, room, quantity, canonical capabilities, `photo` source, and last-updated time. Edit mode permits name, room, and quantity only. Apply the graph update after the server confirms success, not optimistically.

Deletion uses a separate explicit confirmation naming the item. A failed save or delete keeps the last confirmed graph state and shows the server hint. Closing the inspector or navigating away discards unsaved edits. Focus enters the inspector predictably and returns to the selected node when it remains available.

### Node tooltips

Render one viewport-clamped HTML tooltip above the SVG layers. Open it on pointer hover and keyboard focus, support touch inspection, and dismiss it on pointer leave, blur, Escape, view change, node removal, or navigation. Position and visibility are cosmetic state: they never mutate D3 data, restart physics, or move nodes. Connect focused nodes to visible content with `aria-describedby` or equivalent semantics and avoid duplicate screen-reader announcements.

Tooltip content is compact and type-specific: rooms show item/hotspot counts and their action; unscanned rooms show the scan action; items show room, quantity, capability count, and a short capability preview; shared hubs show owner count and a short owner preview; unique minis show owner and tier; new capabilities show provisional/new status and tier; ghosts show product, price when known, and evaluation phase. Every essential fact and action remains reachable without hover.

### Node taxonomy

| Node | Required treatment |
|---|---|
| Item node | Adaptive cool-slate circle with a small item dot, centred wrapped item name, optional `+N` unique-capability indicator, thin border, and no glow. Derive its capped diameter from word count, wrapped-line count, longest line, and badge space. Selection neutrally highlights all connected capability nodes and edges. |
| Capability hub | Neutral pill with a clear lowercase capability label. Degree may change prominence; hot hubs get stronger neutral emphasis, never category colours. Visible only under the hub rules in `PDD.md`. |
| New capability hub | Green border, restrained green tint, and slightly more weight than a normal hub. No glow. |
| Ghost | Dashed coral circle showing the wrapped product name, price when known, and `considering`. Size the diameter from the product's word count and longest wrapped line, with a firm maximum so it cannot dominate the graph. It is the only glowing node; keep the glow subtle. |
| Mini capability | Small, dim, dashed pill hidden until its item expands. Allow one expanded item at a time. |
| Room | Neutral circle sized by item count with a clear label. A home-level hotspot may carry the only amber badge. The routed room receives announced emphasis. |
| Unscanned room | Dim, dashed room with a semantic “scan this room” action. |

Dashed treatment communicates provisional/not-owned state according to `PDD.md`; do not use arbitrary decorative dashes.

### Edge taxonomy

| Edge | Required treatment |
|---|---|
| Inventory primary | Neutral graphite, approximately `1.8×` secondary width. |
| Inventory secondary | Thinner neutral graphite. |
| Scan | Very faint dashed neutral line, briefly fanning to every relevant node or room. |
| Covered | Coral `--covered`. |
| New | Green `--new`, slightly heavier. |
| Pulse | Animated coral dash-flow for no more than two seconds; a restrained transient halo is permitted only as required by VIS-4. |
| Cross-room | Rare, thin, dashed, and neutral; only for true cross-domain overlap. |

Do not give every edge equal contrast. Inventory structure should recede behind active verdict evidence.

## Verdict panel

The panel is a compact inspector, not a stack of large cards. Render this exact order:

1. Product name and price.
2. `X of Y covered`.
3. Coverage bar.
4. `N % of this, you already own`.
5. Capability checklist rows.
6. Delta economics.
7. Alternative suggestion.
8. Actions.

Use the exact delta and approval copy from CNT-4 in `PDD.md`. The approval path, including `Genuinely new — nothing you own does this`, must feel as complete as the redundancy verdict—not like an error, warning, or empty state.

Each checklist row is an actual semantic interactive control. A covered row contains a coral state indicator, capability name, tier, best coverer, and additional coverer count when applicable (`{coverer} + N more`). A new row contains a green state indicator, capability name, and `not owned — new`. Pair colour with text, icon, line style, or another non-colour cue.

Rows and edges must derive from the same verdict object. Preserve these exact IDs:

```ts
ghost->${capSlug}
e:${itemId}->${capSlug}
```

Row activation resolves its single corresponding edge by ID and pulses exactly that edge. Never use text matching, array position, DOM traversal, or duplicated verdict state.

Actions are:

- Primary: `Skip this purchase`—close the verdict and preserve the impact update in application state.
- Secondary: `I still need it`—reveal `What's it for? teaches the graph`, then preserve the existing Buy anyway path.

Do not frame the tool as a blocker or remove the Buy path.

## State and motion

One reducer owns the flow:

```text
resting → extracting → scanning → settling → verdict
```

`route` remains a distinct home-level sub-beat. Fetch the complete evaluation result first, then reveal it client-side in this order:

1. Capability chips appear; primary is brighter and secondary is dimmer.
2. The pinned ghost briefly scans every node, or every room at home level.
3. The winning room is announced by a route toast; other rooms fade to about 35%.
4. Hold the toast for `600ms` before camera movement.
5. Ease the camera into the room. If no match clears the threshold, do not dive; remain home and show approval.
6. Unpin the ghost and let the force simulation move it into the cluster.
7. Replace scan lines with real covered and new edges.
8. Enter the verdict panel beside the graph.

Never manually tween a node journey. Movement comes from state changes plus force simulation reactions. The camera moves only after user input or an announced route.

Motion budgets:

- micro-interactions: `150–300ms`;
- chip stagger: about `320ms`;
- scan fan: at most `0.9s`;
- camera: `700–900ms`;
- settle: at most about `1.5s`;
- verdict panel: about `300ms`;
- route toast hold: exactly `600ms` before camera motion;
- edge pulse: at most `2s`.

Use eased motion; only edge dash-flow may be linear. Do not add decorative entrances unrelated to computation.

Photo preparation, scanning, review, and saving are explicit state changes but do not join the four-beat product-evaluation choreography. Use a quiet indeterminate status for real waiting, prevent duplicate submission, and avoid fabricated progress. Inventory refresh may structurally rebuild the graph only after confirmation succeeds.

### Reduced motion

Under `prefers-reduced-motion`:

- show capability chips immediately;
- skip choreography directly to the verdict;
- avoid animated camera movement where possible;
- replace edge animation with a strong static highlight;
- preserve every action, relationship, and inspection affordance.

Every new animation needs this escape hatch.

## Responsive behaviour

At and above roughly `720px`, graph and verdict sit side by side, the graph receives most width, input stays easy to reach, and the verdict has a bounded width.

Below roughly `720px`:

- keep one product flow and one canvas;
- render the graph first and stack the verdict beneath it;
- place photo review and the item inspector in the same full-width contextual position as the verdict;
- keep the command bar and actions reachable one-handed;
- wrap or horizontally scroll example chips;
- preserve generous touch targets and readable labels;
- make every important action available without hover;
- never shrink node labels into illegibility.

On the landing page, stack the three-step sequence and keep the primary graph action visible without horizontal scrolling. Do not create a separate mobile route, graph, or reduced product flow.

## Accessibility

- Use semantic HTML for inputs, buttons, notices, and interactive verdict rows.
- Make all controls and rows keyboard-operable with a clearly visible neutral focus indicator.
- Give graph actions accessible names where practical and expose equivalent non-canvas controls for essential actions.
- Make tooltip content available through focus and touch, with Escape dismissal and no hover-only actions.
- Associate photo-review validation with its candidate fields, announce scan/save status without fake progress, and return focus after cancel or confirmation.
- Treat route headings as focus destinations and provide a useful not-found page with links to both routes.
- Do not rely on colour alone for `covered` versus `new`; retain text and shape/style cues.
- Use adequate touch padding and readable contrast on every graphite surface.
- Announce route, error, and result changes appropriately without producing duplicate screen-reader chatter.
- Respect reduced motion without removing functionality or inspectability.

## Component guidance

Reuse the current framework, graph library, styling approach, and working application logic. Centralize the tokens above and prefer focused reusable primitives over repeated class strings. Existing equivalents are preferable to parallel components; useful boundaries include:

```text
AppShell
LandingPage
GraphPage
ProductCommandBar
DemoProductChips
InventoryStatus
PhotoCapture
PhotoReview
ItemInspector
GraphWorkspace
GraphTooltip
RoomNode
ItemNode
CapabilityHubNode
GhostNode
GraphEdge
RouteToast
VerdictPanel
CoverageSummary
VerdictRow
DeltaEconomics
VerdictActions
ImpactCounter
```

Keep graph, inventory, and verdict data derived, never duplicated. Page components consume one normalized active-inventory source: guest JSON for guests and Clerk-scoped personal data for accounts. Do not put database rows directly into D3 selections or hardcode verdict percentages, demo outcomes, node positions, or scoring results into UI components. Preserve all fixed copy, semantic laws, and IDs from `PDD.md`.

## Do / do not

### Do

- Make the graph the protagonist and the shell a quiet frame.
- Keep `/` compact and graph-free; keep `/graph` focused on the working graph.
- Use the exact light neutral ladder, hairlines, compact spacing, and small radii.
- Use coral only for covered/redundant evidence and green only for genuinely new evidence.
- Reserve amber for home hotspot badges and glow for the ghost, apart from the brief VIS-4 pulse exception.
- Keep panels dense, typography calm, controls compact, and supporting text muted.
- Preserve force-driven emergence, edge inspectability, offline demo arcs, approval, and both decision actions.
- Make guest, account loading, empty, error, and populated inventory states visually explicit.
- Discard raw photos and review-only information after cancel, navigation, failure cleanup, or successful confirmation.
- Verify desktop, mobile, keyboard, reduced-motion, simulation cooling, and every row-to-edge mapping.

### Do not

- Do not restore Linear lavender or introduce any third speaking colour.
- Do not add gradients, glass effects, neon glows, strong grids, excessive shadows, huge type, giant radii, or large floating cards.
- Do not turn `/graph` into a landing page, dashboard, issue tracker, or competing multi-canvas view; do not let `/` grow into a generic marketing site.
- Do not make all nodes or edges equally loud.
- Do not hardcode positions, domains, scores, percentages, or demo-only visual outcomes.
- Do not reheat physics for hover, highlighting, selection, or edge pulse.
- Do not persist raw images, provider output, confidence, evidence, warnings, or review drafts; do not expose capability editing or manual item creation.
- Do not add idle node motion, arbitrary interactions, a browser extension, persistent override learning, or other remaining `SCP-1` scope.
