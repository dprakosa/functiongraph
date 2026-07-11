# FunctionGraph

FunctionGraph is an anti-redundancy purchase copilot. It decomposes a product
into capabilities, compares them with a structured inventory, and shows what is
already covered and what is genuinely new in a live force-directed graph and
verdict checklist.

Matching happens at the capability level, not by product name. The result is
decision support—coverage plus the genuinely-new delta—and never removes the
user's Buy anyway path.

The implementation follows [PDD.md](./PDD.md), the product and system source of
truth. Its requirements take precedence over this README and code comments;
normative values may only change with human sign-off and a PDD decision-log
entry. The app uses React, TypeScript, D3, SVG, versioned JSON data, and a
single Vercel-compatible evaluation endpoint. There is no database or
persistence.

Visual implementation follows [DESIGN.md](./DESIGN.md), which combines a
Linear-inspired bright, compact interface discipline with FunctionGraph's
graph-first layout and fixed coral/green semantic colour law. `PDD.md` remains
higher precedence whenever the two documents differ.

## Run locally

```bash
npm ci
npm run dev
```

Open the Vite URL shown in the terminal, normally
`http://127.0.0.1:5173/`. The development server also runs the local
`POST /api/evaluate` handler.

The three example chips work immediately without an API key or network call.
Evaluating any other product requires the live API configuration below.

## Offline demo arcs

- **Convection countertop oven — $129:** 4 of 5 covered, 75 % weighted
  coverage, with `roasts large meals` as the $129 new function and a
  secondhand roasting-pan alternative.
- **4th USB-C cable — $15:** 100 % covered and nothing new.
- **Mini camera drone — $89:** 0 % covered and the designed “genuinely new”
  approval state.

These decompositions live in `src/data/demoCache.json` and are always rescored
against `src/data/inventory.json`, so cached and live evaluations use the same
coverage math.

## Main interactions

- Tap a room to enter it, then use Back to return home.
- Paste a product or tap an example to run extract, scan, route, settle, and
  verdict beats.
- Pan or wheel-zoom the canvas and drag graph nodes.
- Tap an item to highlight every connected capability and reveal its unique capabilities.
- Tap a verdict row to highlight exactly its graph edge.
- Skip a purchase to record the avoided impact, or choose “I still need it”
  and record a reason before buying anyway.
- Use the responsive stacked layout on phones; reduced-motion preferences skip
  the choreography and retain static evidence highlighting.

## Live API configuration

`POST /api/evaluate` accepts `{ "text": string }` with 3–1500 characters.
Bundled examples are resolved first, followed by an in-memory memo and then the
live structured decomposition path.

A successful response has this shape:

```ts
{
  name: string;
  price: number | null;
  capabilities: Array<{ name: string; tier: "primary" | "secondary" }>;
  verdict: {
    coverage: number;
    coveredCount: number;
    totalCount: number;
    rows: Row[];
    newCapabilities: string[];
    pricePerNewCapability: number | null;
  };
  altSuggestion: string | null;
  cached: boolean;
}
```

Failures use `{ "error": string, "hint": string }`; the hint always gives the
user a next step. Non-`POST` requests receive the same shaped contract with a
405 status.

Set these server-side environment variables for arbitrary product evaluation:

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini-2025-04-14
OPENAI_EMBED_MODEL=text-embedding-3-small
OPENAI_EMBED_REVISION=deployment-v1
```

All four values are required for the live path. `OPENAI_MODEL` must be an
immutable dated snapshot rather than a mutable alias. OpenAI embeddings use a
stable model ID rather than a dated public snapshot, so
`OPENAI_EMBED_REVISION` is the deployment-owned cache revision: bump it whenever
the embedding model or configuration changes so vocabulary vectors are
regenerated. See [`.env.example`](./.env.example). API keys must never be
exposed to the client.

For Vercel, deploy the repository as a Vite project, use `npm run build`, set
the output directory to `dist`, and configure the environment variables above.
`api/evaluate.ts` is deployed as the serverless function. The bundled demo arcs
continue to work if the live service is unavailable.

## Repository map

- `DESIGN.md` — authoritative visual tokens, component treatments, motion,
  responsive, and accessibility rules.
- `src/components/ProductCommandBar.tsx` — cache-aligned product entry and
  offline demo chips.
- `src/App.tsx` — reducer-owned product flow and verdict UI.
- `src/components/GraphCanvas.tsx` — force-directed SVG renderer.
- `src/graph/buildGraph.ts` — graph data derived from inventory and verdicts.
- `src/state/` — evaluation client, reducer, and four-beat scheduler.
- `src/lib/` — scoring, vocabulary, routing, copy, and graph derivation.
- `src/data/` — versioned inventory and decomposition-only demo cache.
- `api/evaluate.ts` and `api/_lib/` — serverless API, resolution handler, and
  live structured decomposition/canonicalization.

## Verify

```bash
npm test
npm run build
```

`npm test` runs the Vitest suite covering data and naming invariants, cache and
input normalization, the three normative scoring arcs, graph derivation and
row-to-edge integrity, and API validation. `npm run build` runs the TypeScript
project build followed by the Vite production build.

For watch mode or a local production preview:

```bash
npm run test:watch
npm run preview
```
