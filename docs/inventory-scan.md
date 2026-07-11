# Inventory photo scan

`POST /api/inventory/scan` turns one household photo into an ephemeral draft
inventory. The endpoint is backend-only: it does not provide a camera UI,
confirm candidates, update the bundled `inventory.json`, or persist scan data.
Candidates can be assigned to any of the four active rooms—Kitchen,
Electronics, Garage, or Bathroom—or left unclassified.

## Request

The request must carry a valid Clerk session and JSON shaped as:

```ts
{
  imageDataUrl: "data:image/jpeg;base64,...";
  roomHint?: string;
}
```

JPEG, PNG, and WebP are accepted. Remote URLs, GIF, HEIC, malformed base64,
MIME/content mismatches, decoded files over 2.5 MiB, and images over 40
megapixels are rejected. `roomHint` is optional and limited to 80 characters.

## Response

```ts
{
  items: Array<{
    id: string; // candidate-1, candidate-2, ...
    name: string;
    quantity: number | null; // approximate when present
    suggestedDomain:
      | "kitchen"
      | "electronics"
      | "garage"
      | "bathroom"
      | "unclassified";
    confidence: "high" | "medium" | "low"; // review priority only
    evidence: string;
    capabilities: Array<{
      name: string;
      tier: "primary" | "secondary";
    }>;
  }>;
  warnings: string[];
  needsReview: true;
}
```

No recognizable objects is a successful `200` with `items: []`. All errors
use `{ error, hint }`: 400 for malformed requests, 413 for size/pixel limits,
415 for media problems, 422 for unusable/refused images, 429 for rate limits,
and 503 for configuration or provider failures.

## Processing and privacy

The backend validates image content, applies EXIF rotation, strips metadata,
flattens transparency, resizes within 2048×2048, and encodes a quality-82 JPEG.
It makes one structured vision request with high image detail and then reuses
the authenticated user's Neon inventory vocabulary. Exact capability strings
are reused first;
all unmatched strings across all candidates share one embeddings batch and
snap at cosine similarity 0.83.

Images and raw provider output are never returned, logged, cached, or stored.
Provider storage is disabled, responses use `Cache-Control: no-store`, and the
Clerk user id is sent only as a SHA-256 safety identifier. The in-memory limit
is three provider calls per Clerk user per minute; it is best-effort per
serverless instance.

The successful response remains an ephemeral review draft. A later explicit
`POST /api/inventory/items` request may persist only selected `name`, `domain`,
`quantity`, and canonical `capabilities`; candidate ids, evidence, confidence,
warnings, and image data are rejected by that API.

## Deployment

Configure the Clerk, Neon, and OpenAI variables shown in
[`.env.example`](../.env.example).
`OPENAI_VISION_MODEL` must be a dated model snapshot; if it is omitted, the
endpoint uses the pinned `OPENAI_MODEL`. The scan also requires the configured
embedding model/revision for capability canonicalization.

The local Vite middleware does not emulate Clerk for this nested endpoint. Use
a Vercel preview/deployment for authenticated end-to-end checks. Automated
tests mock Clerk and OpenAI and do not make network requests.
