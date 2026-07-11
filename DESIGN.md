# FunctionGraph visual implementation guide

## Authority and intent

This is the repository's authoritative visual implementation guide. **`PDD.md` is the highest-precedence source of truth**—that is the actual specification filename in this repository. If this guide, the generated Linear reference, `README.md`, `CLAUDE.md`, `visualization-design.md`, code comments, or chat history conflicts with `PDD.md`, follow `PDD.md`. Do not alter normative requirement IDs, values, algorithms, state ordering, or scope through visual work.

FunctionGraph is a precise, dark, technical decision tool: Linear-inspired interface discipline applied to a node-editor workspace. Keep the ultra-minimal dark shell, dense readable layout, surface ladder, hairline borders, compact controls, strong type hierarchy, and fast polish. The graph—not a marketing page or dashboard grid—is the product and the visual centre.

It must not resemble a generic SaaS landing page, a collection of unrelated cards, a colourful analytics dashboard, neon cyberpunk, glassmorphism, a Linear issue-tracker clone, or a marketing homepage wrapped around a graph.

## Design laws

1. The live graph is the dominant surface at every viewport.
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
  color-scheme: dark;

  --background: #08090a;
  --surface-1: #0d0e10;
  --surface-2: #121316;
  --surface-3: #18191d;

  --border-subtle: rgba(255, 255, 255, 0.07);
  --border-default: rgba(255, 255, 255, 0.11);
  --border-strong: rgba(255, 255, 255, 0.18);

  --text-primary: #f2f3f5;
  --text-secondary: #a3a6ad;
  --text-muted: #6f737b;

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

Amber has no general semantic token. If an existing amber is used, confine it to the badge inside a home-level hotspot room; never use it for warnings, actions, verdicts, edges, focus, or room fills. Do not introduce blue, purple, cyan, pink, or yellow status colours. Linear lavender is not part of FunctionGraph.

## Typography, shape, and density

Use the existing sans stack where possible:

```css
font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont,
  "Segoe UI", sans-serif;
```

- Use sentence case everywhere and the fixed vocabulary in `PDD.md`.
- Prefer 12–16px working text, compact 18–24px headings, medium weights, tight but readable line heights, and restrained negative tracking only on headings.
- Use `font-variant-numeric: tabular-nums` for prices, percentages, scores, coverage counts, and the impact counter.
- Use `--text-secondary` and `--text-muted` for supporting copy; never solve hierarchy with many colours.
- Do not place a giant hero heading in the application.
- Use only the 4, 8, 12, 16, 20, 24, 32 spacing scale.
- Default to 6–10px radii. Reserve full pills for nodes, capabilities, statuses, and compact chips—not panels or ordinary buttons.
- Keep controls compact on desktop while preserving generous touch padding.

## Application composition

Use one compact app shell containing:

- FunctionGraph wordmark or text logo;
- a quiet one-line description where useful;
- the impact counter (`$X kept · Y kg landfill avoided`);
- a back control whenever the user is off home level;
- product command bar and mandatory example chips;
- the graph workspace, route toast, and verdict panel.

The graph occupies most of the available viewport and most desktop width. Do not surround it with a conventional dashboard grid. On desktop, place the verdict beside the graph with a sensible maximum width and fit the camera to both; never replace or obscure the graph.

### Product command bar

Treat product entry as a precise command-bar control: compact but prominent, on an elevated graphite surface, with a thin border, integrated submit action, visible neutral keyboard focus, and resilient wrapping for long input. Errors are friendly inline text that explains the next step; never apologize. The arrival flow has no spinner because the full result is fetched before choreography starts.

Always expose these exact one-tap demo strings, matching the demo cache:

- `Convection countertop oven — $129`
- `4th USB-C cable — $15`
- `Mini camera drone — $89`

Chips wrap or scroll horizontally rather than shrinking below legibility.

## Graph workspace

Home and room views are data swaps and camera moves on the same force-directed canvas. Keep drag, zoom, pan, room navigation, and force behaviour intact. Use a subtle dark dotted node-editor background; avoid strong grid lines and visually loud canvas controls.

Never hardcode node positions or domain membership. Seed structural updates from current positions, let clusters emerge from shared capabilities, allow the simulation to cool fully, and never add idle motion. Reheat only for structural change: phase, expansion, a new result, or local drag. Hover, selection, row pulse, and other cosmetic highlights must not reheat the full simulation.

### Node taxonomy

| Node | Required treatment |
|---|---|
| Item chip | Compact horizontal graphite chip with a small item dot, item name, optional `+N` unique-capability indicator, thin neutral border, and no glow. |
| Capability hub | Neutral pill with a clear lowercase capability label. Degree may change prominence; hot hubs get stronger neutral emphasis, never category colours. Visible only under the hub rules in `PDD.md`. |
| New capability hub | Green border, restrained green tint, and slightly more weight than a normal hub. No glow. |
| Ghost | Dashed coral chip showing name, price when known, and `considering`. Coral text or restrained tint. It is the only glowing node; keep the glow subtle. |
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

- Primary: `Skip this purchase`—update the impact counter in the same viewport.
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
- keep the command bar and actions reachable one-handed;
- wrap or horizontally scroll example chips;
- preserve generous touch targets and readable labels;
- make every important action available without hover;
- never shrink node labels into illegibility.

Do not create a separate mobile route, graph, or reduced product flow.

## Accessibility

- Use semantic HTML for inputs, buttons, notices, and interactive verdict rows.
- Make all controls and rows keyboard-operable with a clearly visible neutral focus indicator.
- Give graph actions accessible names where practical and expose equivalent non-canvas controls for essential actions.
- Do not rely on colour alone for `covered` versus `new`; retain text and shape/style cues.
- Use adequate touch padding and readable contrast on every graphite surface.
- Announce route, error, and result changes appropriately without producing duplicate screen-reader chatter.
- Respect reduced motion without removing functionality or inspectability.

## Component guidance

Reuse the current framework, graph library, styling approach, and working application logic. Centralize the tokens above and prefer focused reusable primitives over repeated class strings. Existing equivalents are preferable to parallel components; useful boundaries include:

```text
AppShell
ProductCommandBar
DemoProductChips
GraphWorkspace
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

Keep graph and verdict data derived, never duplicated. Do not hardcode verdict percentages, demo outcomes, node positions, or scoring results into UI components. Preserve the seven-interaction ceiling from INT-1–INT-7 and all fixed copy and IDs from `PDD.md`.

## Do / do not

### Do

- Make the graph the protagonist and the shell a quiet frame.
- Use the exact graphite ladder, hairlines, compact spacing, and small radii.
- Use coral only for covered/redundant evidence and green only for genuinely new evidence.
- Reserve amber for home hotspot badges and glow for the ghost, apart from the brief VIS-4 pulse exception.
- Keep panels dense, typography calm, controls compact, and supporting text muted.
- Preserve force-driven emergence, edge inspectability, offline demo arcs, approval, and both decision actions.
- Verify desktop, mobile, keyboard, reduced-motion, simulation cooling, and every row-to-edge mapping.

### Do not

- Do not restore Linear lavender or introduce any third speaking colour.
- Do not add gradients, glass effects, neon glows, strong grids, excessive shadows, huge type, giant radii, or large floating cards.
- Do not turn the app into a landing page, dashboard, issue tracker, or split-view router.
- Do not make all nodes or edges equally loud.
- Do not hardcode positions, domains, scores, percentages, or demo-only visual outcomes.
- Do not reheat physics for hover, highlighting, selection, or edge pulse.
- Do not add idle node motion, arbitrary interactions, a database, photo ingestion, a browser extension, persistent learning, or other `SCP-1` scope.
