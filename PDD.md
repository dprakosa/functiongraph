# FunctionGraph — Product & System Specification

**Status:** v1.2 · source of truth
**Precedence:** Where this document conflicts with README.md, CLAUDE.md,
visualization-design.md, code comments, or chat history, **this document
wins**. CLAUDE.md is the operational companion; visualization-design.md is
the expanded visual rationale; both defer here.
**Change control:** Normative values (anything with a requirement ID or a
number in §12) MUST NOT be changed by agents without human sign-off; changes
append to the Decision Log (§14).
**Keywords:** MUST / MUST NOT / SHOULD / MAY are used in the RFC-2119 sense.
Requirement IDs (PR-1, ALG-3, …) are stable and citable.

---

## 1. Product definition

FunctionGraph is an anti-redundancy purchase copilot. It decomposes a
product a person is considering into **functional capabilities**, matches
those against a structured inventory of what they already own, and renders
the overlap as a live force graph plus a verdict checklist — so the person
decides with full knowledge of what the purchase actually adds.

Built for a hackathon judged on **innovation, technical complexity, and
practicality**, with judges operating the deployed app unaccompanied on
their own devices.

**Positioning rules:**
- **PR-1** The system is decision support, MUST NOT be a blocker or a nag.
  Its output is overlap + delta, and the user always retains a Buy path.
- **PR-2** The differentiator is capability-level matching. Name-level
  duplicate detection ("you bought this before") is explicitly not the
  product.
- **PR-3** The three proofs the experience MUST deliver:
  (a) *functional structure is emergent* — rooms are curated navigation,
  while clusters inside them arise from shared capabilities via physics and
  never from hardcoded positions;
  (b) *every claim is inspectable* — each verdict row maps 1:1 to a visible
  edge;
  (c) *the tool can say yes* — a genuinely-new product receives a designed
  approval state.

---

## 2. Glossary (fixed vocabulary)

These words are the interface's vocabulary. UI copy MUST use them and
MUST NOT substitute synonyms.

| Term | Meaning |
|---|---|
| capability | a function a product performs; lowercase verb + object phrase |
| tier | `primary` (main job) or `secondary` (incidental ability) |
| item | a thing the user owns |
| hub | a capability shared by 2+ items, shown as a graph node |
| ghost | the product being considered, before a decision |
| covered | a capability of the ghost that an owned item already provides |
| new | a capability of the ghost that nothing owned provides |
| considering | the ghost's status label |
| hotspot | a high-degree hub (redundancy concentration) |
| room | a curated navigation group of owned items (kitchen, electronics, garage, bathroom) |
| functional cluster | an emergent group connected by shared capabilities inside a room |
| verdict | coverage score + row-by-row checklist + delta economics |

---

## 3. Data model

- **DM-1** `Item { id, name, domain, capabilities: Capability[] }`, where
  `domain` stores the item's curated room label.
- **DM-2** `Capability { name, tier: 'primary' | 'secondary' }`
- **DM-3 (naming law)** Capability names MUST be lowercase, present-tense
  **verb + object** phrases with no brand names, model numbers, or marketing
  adjectives (e.g. `toasts bread`, `charges usb-c devices`). This convention
  applies equally to LLM output, seed inventory, and demo cache; matching
  quality depends on it.
- **DM-4** A product decomposition MUST contain 3–8 capabilities.
- **DM-5** `Verdict { coverage: 0..1, coveredCount, totalCount, rows: Row[],
  newCapabilities: string[], pricePerNewCapability: number|null }`
- **DM-6** `Row { capability, capSlug, tier, covered, bestCoverer,
  covererCount, weight }` — `capSlug` = lowercase, non-alphanumerics
  collapsed to single hyphens.
- **DM-7** Storage is versioned JSON (inventory, demo cache). No database.
- **DM-8** A photo scan candidate is provisional:
  `{ id, name, quantity|null, suggestedDomain, confidence, evidence,
  capabilities }`. `confidence` is a review priority, not a calibrated
  probability. Scan responses MUST carry `needsReview: true` and MUST NOT
  mutate DM-7 storage. `suggestedDomain` is `kitchen`, `electronics`,
  `garage`, `bathroom`, or `unclassified`.

---

## 4. Algorithm (normative math)

- **ALG-1 (vocabulary)** The capability vocabulary is derived from the
  inventory at load: for each capability name, `degree` = number of items
  having it, plus the owner list with tiers. Nothing is maintained by hand.
- **ALG-2 (canonicalization order)** For each capability of a considered
  product: (1) the current vocabulary is injected into the decomposition
  prompt with an instruction to reuse exact strings; (2) exact string match
  against vocabulary; (3) otherwise embed the string and snap to the nearest
  vocabulary entry if cosine similarity ≥ **0.83**; (4) otherwise it is a
  new capability. Embedding model MUST be pinned; if it ever changes, all
  stored vectors MUST be regenerated (cross-model vectors are not
  comparable and fail silently).
- **ALG-3 (specificity weighting)** `w_spec(c) = 1 / log2(2 + degree(c))`.
  Generic capabilities (high degree, e.g. `charges usb-c devices`) are
  discounted; distinctive ones weigh more. This is what prevents
  `uses electricity`-class capabilities from fusing domains and inflating
  scores.
- **ALG-4 (tier weighting)** primary = **1.0**, secondary = **0.4**.
- **ALG-5 (coverage — asymmetric, weighted)** Over the **considered
  product's** capabilities only:
  `coverage = Σ_covered (w_spec · w_tier) / Σ_all (w_spec · w_tier)`.
  Direction matters: the question is "how much of what I'd buy do I already
  own," never symmetric similarity.
- **ALG-6 (best coverer)** For a covered capability, the named coverer is
  an owner holding it as `primary` if one exists, else any owner; the row
  also carries total `covererCount`.
- **ALG-7 (delta economics)** `pricePerNewCapability = round(price /
  |newCapabilities|)` when price is known and new capabilities exist;
  otherwise null. Zero new capabilities with a known price yields the copy
  in CNT-4.
- **ALG-8 (hub promotion)** Within each room, capability degree is recomputed
  from that room's items. A capability is a visible hub iff local `degree ≥ 2`,
  capped at the top **8 per room** by degree, then name. Hubs with local
  `degree ≥ 4` receive "hot" emphasis. Degree-1 capabilities are hidden until
  their item is expanded; other non-promoted capabilities materialize when
  needed as verdict evidence.
- **ALG-9 (rooms + cluster emergence)** Room membership comes from DM-1 and
  room order follows first appearance in inventory data. Within a room,
  connected functional clusters emerge exclusively from shared-capability
  edges and force physics; clusters and node positions MUST NOT be hardcoded.
- **ALG-10 (verdicts are always live)** Cached entries store decompositions
  only. `scoreProduct` MUST run on every evaluation so cached and live
  products flow through identical math against the current inventory.

---

## 5. API contracts

- **API-1** The backend exposes two Clerk-protected live endpoints.
  `POST /api/evaluate` accepts `{ text: string }` (3–1500 chars) and returns
  `{ name, price, capabilities, verdict, altSuggestion, cached }`.
  `POST /api/inventory/scan` is specified by API-7. Bundled demo evaluation
  remains available without a live model call.
- **API-2 (resolution order)** (1) bundled demo cache, keyed per API-3 —
  instant, offline-proof; (2) warm in-memory memo; (3) live: structured LLM
  decomposition → canonicalization (ALG-2) → scoring (ALG-5).
- **API-3 (cache key normalization)** `norm(text)`: lowercase →
  non-alphanumerics to spaces → collapse whitespace → strip a trailing
  price token. Every scripted demo product MUST have a demo-cache entry
  whose key equals `norm` of its exact chip text; drift silently routes the
  chip to the live path.
- **API-4 (decomposition call)** Structured/JSON-schema output mode MUST be
  used (no free-text parsing). The schema includes `name`, `price|null`,
  `capabilities[]` (DM-4), `altSuggestion|null` — one sentence describing a
  cheaper or secondhand way to acquire only the delta, when plausible.
- **API-5 (errors carry next steps)** Failures return
  `{ error, hint }` where `hint` tells the user what to do
  ("tap an example — those never touch the network"), per CNT-6. Garbage
  input MUST yield a friendly 4xx hint, never a hang or a crash.
- **API-6** Model snapshots MUST be pinned via environment config.
  A minimal per-IP rate limit SHOULD guard live evaluation. Photo inference
  MUST be limited per authenticated Clerk user to 3 provider calls/minute.
- **API-7 (photo inventory draft)** `POST /api/inventory/scan` accepts
  `{ imageDataUrl, roomHint? }`. It accepts base64 data URLs containing JPEG,
  PNG, or WebP only; decoded input is capped at 2.5 MiB and 40 megapixels.
  Before inference the server MUST validate content against MIME, auto-rotate,
  strip metadata, flatten transparency, resize within 2048×2048, and encode a
  quality-82 JPEG. One structured vision call returns at most 20 grouped item
  candidates with 1–6 capabilities each. Capabilities follow ALG-2, batching
  all unmatched strings in one embeddings request. A successful response is
  `{ items: DM-8[], warnings: string[], needsReview: true }`; no recognizable
  objects is a successful empty list. Failures use API-5's `{ error, hint }`
  shape with 400/413/415/422/429/503 as applicable.
- **API-8 (photo privacy and retention)** Photo input and raw provider output
  are ephemeral: MUST NOT be logged, cached, stored, or echoed. Responses set
  `Cache-Control: no-store`. The provider call MUST disable storage and use a
  one-way hash of the Clerk user id as its safety identifier. The scan creates
  review candidates only; confirmation and persistence are future work.

---

## 6. State machine & the four beats

- **SM-1** One reducer owns the app:
  `resting → extracting → scanning → settling → verdict`, with `route` as a
  distinct sub-beat at home level (SM-4). Every animation is a phase change
  plus the simulation reacting to derived graph data; there are no bespoke
  position tweens (VIS-6).
- **SM-2** The full result is fetched before choreography begins; all
  pacing is client-side reveal. No spinner exists in the arrival flow.
- **SM-3 (timing table — defaults; tune rhythm, preserve order)**

| Beat | Phase(s) | Duration |
|---|---|---|
| 1 · Extract & scan | extracting → scanning | chips ~320 ms stagger; scan fan ≤ 0.9 s |
| 2 · Route | scanning (home) | fade + ring; toast hold **600 ms** before camera moves |
| 3 · Dive & settle | settling | camera 700–900 ms; settle ≤ ~1.5 s |
| 4 · Verdict & act | verdict | panel slide ~300 ms; row pulse ≤ 2 s |

- **SM-4 Beat 1 — Extract & scan.** Capability chips stream one-by-one
  (primary bright, secondary dim) while the ghost appears **pinned** at the
  canvas edge with faint dashed scan lines fanning to *every* node (rooms at
  home level). The fan is honest — comparison really is global — and MUST
  stay brief (theater for a milliseconds computation).
- **SM-5 Beat 2 — Route** (home level). Match weight concentrates: the
  winning room gains a pulsing ring; other rooms and their scan lines fade
  to ~35 % opacity; a toast states the result plainly ("Kitchen · 4 of 5
  matches") and holds 600 ms before any camera motion — auto-navigation
  without warning feels like losing control. Edge cases are designed:
  *multi-room* → dive the strongest room, rows MAY cite cross-room coverers
  with a room tag; *no match above threshold* → **no dive**, ghost stays at
  home level, proceed to the approval state (PR-3c). Never build a split
  view.
- **SM-6 Beat 3 — Dive & settle.** Camera eases into the room. Scan lines
  are replaced by real edges — coral to covered hubs, green to new
  capabilities (materializing hub-new pills). The ghost unpins and the
  reheated simulation drags it into its cluster; the physics IS the
  animation ("watch where it lands").
- **SM-7 Beat 4 — Verdict & act.** The panel slides in **beside** the
  graph, never replacing it; the camera fits both. Panel order: name +
  price → "X of Y covered" + coverage bar + weighted % → checklist rows →
  delta line (ALG-7) → alt suggestion → actions. Tapping a row pulses
  exactly its edge (INT-6). **Skip this purchase** increments the impact
  counter in the same viewport; **I still need it** reveals a one-line
  reason input ("What's it for? teaches the graph") then Buy anyway.
- **SM-8 (structural vs cosmetic changes)** The simulation reheats only on
  structural change (phase, expansion, new result) — seeded from current
  positions so nodes glide rather than teleport. Pulse/highlight changes
  MUST NOT reheat physics.
- **SM-9 (reduced motion)** Under `prefers-reduced-motion`: chips appear at
  once, choreography is skipped straight to verdict, pulse becomes a static
  heavy highlight. Any new animation MUST include this escape hatch.

---

## 7. Visualization

Renderer-agnostic: any force-directed engine meeting these behaviors
qualifies. (Reference stack in §13 is informative.)

- **VIS-1 (semantic color law)** Exactly two speaking colors:
  **coral = covered/redundant**, **green = genuinely new**. Amber appears
  only as home-level redundancy badges. Everything else is quiet graphite
  on a dark dotted node-editor canvas. If a third color needs to speak, the
  design is wrong.
- **VIS-2 (two views, one canvas)** Home level (triage) and room level
  (verdicts) are data swaps plus camera moves on one canvas, never separate
  screens. Home: rooms as circles sized by item count, amber hotspot badges,
  dim dashed "not scanned" rooms (cold-start honesty; tap = future
  ingestion entry), rare thin dashed cross-room edges for true cross-domain
  overlap only. Room: item chips (dot + name + "+N" unique badge),
  capability hub pills per ALG-8, unique capabilities blooming as small
  dashed mini-pills on item click (one expansion at a time).
- **VIS-3 (node taxonomy)** item chip · hub pill · hub-new (green pill) ·
  ghost (dashed coral chip with the app's **only glow**, "name · $price ·
  considering") · mini (dim dashed pill) · room · room-unscanned. Dashed
  always means *provisional/not owned*.
- **VIS-4 (edge taxonomy)** inventory (graphite; width primary ≈ 1.8×,
  secondary ≈ 1×) · scan (faint dashed) · covered (coral) · new (green,
  slightly heavier) · pulse (animated coral dash-flow + glow, ≤ 2 s) ·
  cross-room (thin dashed).
- **VIS-5 (single source of truth)** Verdict rows and ghost edges MUST be
  derived from the same verdict data. Edge id contract:
  `ghost->${capSlug}` for ghost edges, `e:${itemId}->${capSlug}` for
  inventory edges; row-tap resolves edges by this exact string.
- **VIS-6 (motion law)** Movement = state change + simulation reaction.
  Micro-interactions 150–300 ms; camera 700–900 ms; eased, never linear
  (pulse dash-flow excepted). The camera never moves without user
  initiation or an announced cause (the route toast). A back control is
  always visible off-home. The simulation cools to rest — no idle motion.
- **VIS-7 (theater maps to truth)** Every animated beat visualizes a real
  computation. Timing may be stretched for legibility; states are never
  invented.

---

## 8. Interaction inventory (complete)

**INT-1** tap a room → expand into it · **INT-2** tap an unscanned room →
"scan this room" call-to-action · **INT-3** paste a product / tap a
try-these chip → arrival beats · **INT-4** back / zoom out → home ·
**INT-5** click an item → bloom unique capabilities (toggle; hover-tooltip
fallback if cut) · **INT-6** tap a checklist row → pulse its edge ·
**INT-7** verdict actions (Skip / I still need it). Ambient: node drag
reheats locally then cools; hover brightens borders. Seven interactions is
the ceiling — learnable in one viewing.

---

## 9. Content & copy

- **CNT-1** Sentence case everywhere; one quiet sans; tabular numerals for
  the counter.
- **CNT-2** Vocabulary per §2, never synonyms.
- **CNT-3** Voice: verbs from the user's side ("Skip this purchase");
  labels name what happens; an action keeps its name through the flow.
- **CNT-4** Fixed key strings: coverage line "*X of Y covered*"; sub-line
  "*N % of this, you already own*"; delta "*Δ $P buys N new function(s) —
  $K each*" / "*Δ $P buys nothing you don't already own*"; approval
  "*Genuinely new — nothing you own does this*"; row source
  "*{coverer} + N more*" / "*not owned — new*".
- **CNT-5** Impact counter: "*$X kept · Y kg landfill avoided*". The kg
  heuristic (0.018 kg per $) is a placeholder and SHOULD be replaced by a
  per-category table if time allows.
- **CNT-6** Errors explain the next step and never apologize.

---

## 10. Non-functional requirements

- **NFR-1 (offline demo guarantee)** All scripted products resolve from the
  bundled demo cache; the scripted path MUST NOT depend on network or LLM
  availability.
- **NFR-2 (unaccompanied judges)** Try-these chips are mandatory — three
  one-tap examples covering the three arcs (DEM-1) so no judge faces an
  empty input. All arcs completable one-handed on a phone; below ~720 px
  the panel stacks under the graph.
- **NFR-3 (performance)** Graph scale ≈ 36 items across four rooms, with each
  room view bounded by its items + ≤ 8 hubs (+ ghost + minis); simulation
  settles ≤ ~2 s from load and fully stops at rest; beats within SM-3 budgets.
- **NFR-4 (accessibility)** Reduced-motion path (SM-9); visible keyboard
  focus; touch targets are real elements with generous padding.
- **NFR-5 (operational)** Model, vision, and embedding snapshots pinned; renderer
  attribution remains visible if its license requires it; public live path
  rate-limited (API-6); API keys server-side only. Local photo endpoint auth
  is exercised through a Vercel preview/deployment because Vite's development
  middleware only emulates the evaluation handler.

---

## 11. Demo & judging requirements

- **DEM-1 (the three arcs)** (a) *heavy overlap*: convection oven — 4/5
  covered, weighted 75 %, delta = `roasts large meals`, $129/new function,
  alt = ~$20 secondhand roasting pan; (b) *total redundancy*: 4th USB-C
  cable — 100 % covered; (c) *genuinely new*: mini drone — 0 % covered,
  approval state, the tool says yes. All three MUST live in the demo cache
  and MUST be asserted by an automated scoring test.
- **DEM-2 (90-second script skeleton)** hook stat → graph settles, point at
  the fattest hub ("nobody knows they own this until they see it") → oven
  chip → chips stream → scan → route toast → dive → settle → "4 of 5
  covered — $129 for one new function, or a $20 roasting pan" → tap a row,
  edge pulses ("every claim in this panel is a live edge — nothing here is
  hardcoded") → Skip, counter ticks → drone chip ("and when something is
  genuinely new, it says so") → close.
- **DEM-3 (Q&A set-pieces)** "Aren't the air fryer and oven different?" →
  click the air fryer, `crisps food with hot air` blooms: "yes — and the
  system knows exactly how." "What if it's wrong?" → the Buy reason input:
  "that's how it learns what you value."
- **DEM-4 (freeze rule)** Within 4 hours of judging, nothing on the
  scripted path changes unless it is actively broken. A smooth canned demo
  beats a live stumble.

---

## 12. Scope & degradation

- **SCP-1 (out of scope — roadmap/slides only)** browser extension · camera
  UI · scan confirmation/persistence · persistent override learning · capability instance counts ·
  categories beyond kitchen + electronics + garage + bathroom · databases · split-view routing.
  Agents MUST NOT implement these without explicit human sign-off recorded in
  the decision log.
- **SCP-2 (degradation ladder, cut in order)** (1) home level + Beat 2 →
  single-level graph, all domains coexist (clusters still separate
  organically; Beat 2 collapses into Beat 1's scan; no-match still yields
  approval); home view becomes a slide. (2) click-expand → hover tooltip.
- **SCP-3 (never cut)** try-these chips · row↔edge pulse · the three demo
  arcs · the approval state · reduced-motion path.
- **SCP-4 (pressure priority)** demo hardening > row-pulse > chips & error
  UX > impact counter > click-expand > home level > slides.

---

## 13. Reference stack (informative, not normative)

React Flow (@xyflow/react v12) + d3-force · dark node-editor theme ·
`gpt-4.1-mini` (pinned snapshot) with structured outputs ·
`text-embedding-3-small` · Sharp image normalization · Vercel-shaped repo with
two serverless endpoints · JSON seed data (36 items: 13 kitchen, 8 electronics,
8 garage, and 7 bathroom, including
the planted `boils water` and `keeps food warm` weak links and the
degree-7 `charges usb-c devices` hub). An inherited codebase MAY substitute
equivalents that satisfy §§4–10; the numbers in §§4–6 remain normative.

**Tuning knobs (defaults):** snap threshold 0.83 · specificity
1/log2(2+deg) · tier weights 1.0/0.4 · hub cap 8 per room, local hot ≥ 4 · beat timings
per SM-3 · caps per product 3–8 · input 3–1500 chars.

---

## 14. Decision log (why it is this way)

| Decision | Rationale |
|---|---|
| Capability-level matching, not name-level | name duplicates already exist (retailers); functional overlap is the unsolved, defensible claim |
| Overlap + delta framing, never blocking | blockers produce false positives and get disabled; delta converts the tool into decision support |
| Hubs (shared ≥ 2) instead of all capabilities or none | degree-1 capabilities add zero redundancy info; shared hubs are simultaneously labels, evidence, and the clustering mechanism |
| Asymmetric weighted coverage | "how much of what I'd buy do I already own" is the decision-relevant direction |
| Specificity (IDF-style) weighting | prevents generic capabilities from fusing domains and inflating scores |
| Rooms curated, functional clusters emergent | realistic rooms contain unrelated functions; curated navigation avoids artificial capabilities while shared edges and physics still reveal functional structure |
| Verdicts always computed live | cached and live products must flow through identical math |
| Beats as state changes + physics | one mechanism, no tween library, theater stays truthful |
| Route pause (600 ms toast) | auto-navigation without warning reads as losing control |
| Designed approval state | proves PR-1; the drone arc is the best answer to "it just says no" |
| Demo cache + try-these chips | unaccompanied judges + venue networks are the real environment |
| Backend-only photo inventory draft | user sign-off promoted photo ingestion from roadmap scope; one ephemeral vision pass finds visible owned items without adding a database or changing the graph |
| Photo candidates require review | visual identification and approximate counts are uncertain; confirmation and persistence remain future work |
| Scope changes use sign-off + decision log | schedule and project-cost estimates are not normative product requirements; product price/delta economics remain normative in ALG-7 and DEM-1 |
| Four-room, 36-item seed with per-room hubs | human sign-off selected a realistic balanced home; a local top-8 hub budget keeps every room informative without letting the largest room consume global visibility |

---

## 15. Conformance checklist (definition of done)

- [ ] Zero hardcoded node positions; rooms come from inventory and functional clusters emerge from shared capabilities (PR-3a, ALG-9)
- [ ] Capability naming law holds across prompt, inventory, and demo cache (DM-3)
- [ ] Coverage math reproduces DEM-1: oven 4/5 · 75 % weighted · $129/new; cable 100 %; drone 0 % — asserted by an automated test
- [ ] Hub promotion follows ALG-8 in every room (local shared ≥ 2, top 8, hot ≥ 4)
- [ ] Every checklist row pulses exactly one edge; edge id contract intact (VIS-5, INT-6)
- [ ] All four beats run in order within SM-3 budgets; route pause present; no-match path skips the dive and renders approval
- [ ] Cosmetic changes never reheat physics; structural changes glide from current positions (SM-8)
- [ ] Only coral and green carry meaning; the ghost is the only glow (VIS-1, VIS-3)
- [ ] Scripted arcs resolve offline from the demo cache; garbage input returns a hint (NFR-1, API-5)
- [ ] Three arcs completable one-handed on a phone, unaided (NFR-2)
- [ ] Reduced-motion path verified; back control visible off-home (SM-9, VIS-6)
- [ ] Photo scans are ephemeral review drafts (API-7/8); nothing remaining in SCP-1 is implemented; SCP-3 items all present
