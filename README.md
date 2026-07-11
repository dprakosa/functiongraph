# FunctionGraph D3 capability graph demo

An interactive, standalone capability-comparison workspace built with React,
TypeScript, D3 and SVG. The demo uses mock data only; it has no backend or
persistence requirements.

## Run locally

```bash
npm install
npm run dev
```

Open the local Vite URL at `/graph-demo` (for example,
`http://localhost:5173/graph-demo`). The root URL shows the same isolated demo
because this repository intentionally has no routing dependency.

For a production build:

```bash
npm run build
npm run preview
```

## Scenarios

- Digital air fryer vs a Breville convection oven setup (82% overlap)
- Manual vegetable chopper vs a food processor setup (91% overlap)
- Electric pressure cooker vs separate cookers and steamer (58% overlap)

The typed mock datasets live in `src/data/graphScenarios.ts`; the graph domain
types live in `src/types/graph.ts`.

## Interactions

- Pan, mouse-wheel zoom, zoom controls, fit view and reset layout
- Drag nodes and click a node to inspect its neighbourhood
- Search for a node and centre it in the canvas
- Filter node categories and relationship types
- Toggle relationship labels
- Switch between all three mock product-comparison scenarios
- Reveal the guided candidate-to-capability comparison path
- Collapse the legend and responsive side panels

## Tests

```bash
npm test
```

The lightweight test suite checks scenario availability and switching, node
selection, type filtering, layout reset wiring, and comparison-path state.
