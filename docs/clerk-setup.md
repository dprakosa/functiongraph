# Clerk setup

Clerk protects only the production live-evaluation request. It does not gate the application shell or the three bundled demo arcs.

The browser integration uses `@clerk/react`; the Vercel function uses `@clerk/backend`. When a client publishable key is present, [`src/main.tsx`](../src/main.tsx) mounts the app inside `ClerkProvider` and the auth UI exposes modal sign-in/sign-up or account/sign-out controls as appropriate, without adding an application route. With no client key, the app deliberately starts in guest-demo mode instead of failing to render. The app also stays mounted while Clerk loads and falls back to the guest-demo status if Clerk cannot load.

Production `POST /api/evaluate` requests pass through [`api/evaluate.ts`](../api/evaluate.ts) and the Clerk verifier in [`api/_lib/auth.ts`](../api/_lib/auth.ts) before reaching the existing evaluator. Non-`POST` requests still return `405` before authentication. A verified request reaches the existing cache → memo → live resolution unchanged.

## Environment contract

| Variable | Visibility | Purpose |
| --- | --- | --- |
| `VITE_CLERK_PUBLISHABLE_KEY` | Client-safe | Enables `ClerkProvider` and the auth controls in the Vite bundle. This is the only Clerk variable that may use the `VITE_` prefix. |
| `CLERK_PUBLISHABLE_KEY` | Server-only | Identifies the same Clerk instance to the Vercel authentication wrapper. Keep it in server/platform configuration even though a Clerk publishable key is not itself a secret. |
| `CLERK_SECRET_KEY` | Server-only, secret | Lets `@clerk/backend` authenticate requests. Never expose it in client code, logs, screenshots, or a committed env file. |
| `CLERK_AUTHORIZED_PARTIES` | Server-only | Comma-separated allowlist of exact browser origins accepted from the session token's authorized-party (`azp`) claim. |

The client and server publishable keys and the secret key must belong to the same Clerk instance. Do not combine development and production keys.

Each authorized party must be an origin only: scheme, host, and optional port. Do not add a path, query, fragment, trailing slash, or wildcard. Origins are exact, so `http://localhost:5173` and `http://127.0.0.1:5173` are different parties. Include each production domain and each preview or branch domain that is meant to call the function.

### Local example

The following is a shape-only example for an uncommitted `.env.local`; none of these placeholders is a usable credential:

```dotenv
VITE_CLERK_PUBLISHABLE_KEY=pk_test_REPLACE_WITH_A_DEVELOPMENT_PUBLISHABLE_KEY
CLERK_PUBLISHABLE_KEY=pk_test_REPLACE_WITH_THE_SAME_PUBLISHABLE_KEY
CLERK_SECRET_KEY=sk_test_REPLACE_WITH_A_DEVELOPMENT_SECRET_KEY
CLERK_AUTHORIZED_PARTIES=http://127.0.0.1:5173
```

Remove `VITE_CLERK_PUBLISHABLE_KEY` to exercise the explicit no-Clerk guest mode. Do not commit `.env.local`; check `git status` before committing.

`npm run dev` binds Vite to `127.0.0.1`. Its `/api/evaluate` middleware is a loopback development convenience that calls the evaluator directly. It does **not** run or emulate the production Vercel Clerk wrapper, even when all server variables above are present. Local success therefore proves evaluator behavior, not end-to-end authentication. Use a Vercel preview or deployment for the auth checks below.

### Vercel preview and production examples

Configure values in the appropriate Vercel environment rather than committing them:

```dotenv
# Preview example: use one Clerk development instance consistently.
VITE_CLERK_PUBLISHABLE_KEY=pk_test_REPLACE_WITH_PREVIEW_PUBLISHABLE_KEY
CLERK_PUBLISHABLE_KEY=pk_test_REPLACE_WITH_THE_SAME_PREVIEW_KEY
CLERK_SECRET_KEY=sk_test_REPLACE_WITH_PREVIEW_SECRET_KEY
CLERK_AUTHORIZED_PARTIES=https://functiongraph-git-feature-example.vercel.app
```

```dotenv
# Production example: use one Clerk production instance consistently.
VITE_CLERK_PUBLISHABLE_KEY=pk_live_REPLACE_WITH_PRODUCTION_PUBLISHABLE_KEY
CLERK_PUBLISHABLE_KEY=pk_live_REPLACE_WITH_THE_SAME_PRODUCTION_KEY
CLERK_SECRET_KEY=sk_live_REPLACE_WITH_PRODUCTION_SECRET_KEY
CLERK_AUTHORIZED_PARTIES=https://functiongraph.example.com,https://functiongraph-production-example.vercel.app
```

Replace every example origin with the exact deployed origin visible in the browser. Vercel environment changes apply only to a subsequent deployment, so redeploy after adding or changing a key or authorized party. Because wildcard parties are not accepted, prefer a stable preview/branch alias when repeated preview testing is needed, or update the exact preview origin and redeploy.

## Guest demo and live evaluation

The three try-these chips are bundled in the client:

- `Convection countertop oven — $129`
- `4th USB-C cable — $15`
- `Mini camera drone — $89`

They are normalized, found in the bundled demo cache, and rescored in the browser. Selecting one makes no call to Clerk, `/api/evaluate`, or the LLM. They continue to work while signed out, with Clerk unconfigured, and while the browser is offline.

Any input not found in that bundled cache uses the relative URL `/api/evaluate`. Fetch's default same-origin credential mode sends the Clerk session cookie automatically when the browser and endpoint share an origin; the app does not need to copy a token into an `Authorization` header. Keep this request same-origin. A separate API origin would require a deliberate CORS and credential design that this integration does not provide.

The resulting behavior is:

| Client state | Bundled chip | Other input on a deployed app |
| --- | --- | --- |
| Clerk key absent | Works locally, with no network | The request is unauthenticated; the server returns an actionable auth/configuration error. |
| Signed out | Works locally, with no network | `401`; sign in or use a bundled example. |
| Signed in | Works locally, with no network | The same-origin session is verified, then the existing evaluator runs. |

## Server verification and errors

The production wrapper calls Clerk's `authenticateRequest()` with:

- `acceptsToken: "session_token"`, so API keys, machine tokens, and other token classes cannot authorize evaluation;
- the parsed `CLERK_AUTHORIZED_PARTIES` list, so a session minted for an unexpected origin is rejected; and
- the server publishable and secret keys, never a client-supplied secret.

Authentication failures use the application's `{ error, hint }` response shape. Responses are intentionally actionable but do not expose a token, key, Clerk diagnostic, or verifier internals.

| Status | Meaning | What to do |
| --- | --- | --- |
| `401` | Session is missing, expired, invalid, pending/incomplete, the wrong token type, or from an unauthorized party. | Sign in again. If already signed in, complete any required Clerk task and confirm the browser origin exactly matches `CLERK_AUTHORIZED_PARTIES`. The bundled examples remain available. |
| `503` | Required server configuration is missing/invalid, or Clerk verification is temporarily unavailable. | Check the three server variables and exact-origin list in the deployment environment, then redeploy. If configuration is sound, retry after the verifier recovers; use a bundled example meanwhile. |
| `405` | `/api/evaluate` was called with a method other than `POST`. | Send JSON with `POST`. |
| `500` | An unexpected failure occurred after the wrapper accepted the request. | Retry or use a bundled example; inspect server logs without returning their details to the browser. |

Do not turn a `503` into an auth bypass. Missing Clerk configuration must fail the deployed live path closed; only the local, bundled demo path is guaranteed without authentication.

## Validation

Run the repository checks from the project root:

```sh
npm ci
npm test
npm run build
git diff --check
```

After building, this scan should find no secret value or secret/allowlist server variable name in the browser output. The configured client publishable key is expected to be public, and the Clerk client SDK may mention its publishable-key variable name in diagnostics.

```sh
rg -n 'CLERK_(SECRET_KEY|AUTHORIZED_PARTIES)|sk_(test|live)_' dist
```

Validate the guest guarantee locally with the browser's Network panel open:

1. Start with `VITE_CLERK_PUBLISHABLE_KEY` absent and run `npm run dev`.
2. Confirm the guest-demo state renders.
3. Switch the browser offline and select all three chips.
4. Confirm each result renders and no `/api/evaluate` request appears.

An unsigned request to the local Vite middleware can return a result, illustrating why it is not an authentication test:

```sh
curl -i http://127.0.0.1:5173/api/evaluate \
  -H 'content-type: application/json' \
  --data '{"text":"Convection countertop oven — $129"}'
```

Use an HTTPS Vercel preview/deployment for end-to-end verification:

1. Configure all four variables for that Vercel environment, include its exact origin in `CLERK_AUTHORIZED_PARTIES`, and deploy.
2. In a signed-out/private browser, confirm the app and three chips work. A direct `POST /api/evaluate` must return `401`, not a redirect or HTML error.
3. Sign in, confirm the account/sign-out control appears, then run the same-origin probe below in that browser's console. It deliberately uses a cached product so it exercises Clerk and the handler without requiring an LLM call.
4. Sign out and repeat the probe; it must return `401` with JSON `error` and `hint` fields.
5. Send an invalid bearer token with `curl`; it must return the same sanitized `401` shape.
6. On a disposable preview, omit one server variable and confirm the same `POST` returns a controlled `503`. Restore the variable and redeploy.
7. Confirm a signed-in probe succeeds on every allowlisted origin and is rejected on an otherwise valid but unlisted preview origin. This verifies exact `authorizedParties` handling rather than merely proving that a session exists.

```js
await fetch("/api/evaluate", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ text: "Convection countertop oven — $129" }),
}).then(async (response) => ({
  status: response.status,
  body: await response.json(),
}));
```

```sh
DEPLOYMENT_ORIGIN=https://functiongraph-preview-example.vercel.app
curl -i "$DEPLOYMENT_ORIGIN/api/evaluate" \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer definitely-not-a-session-token' \
  --data '{"text":"Convection countertop oven — $129"}'
```

References: [Clerk React + Vite quickstart](https://clerk.com/docs/react/getting-started/quickstart), [`authenticateRequest()`](https://clerk.com/docs/reference/backend/authenticate-request), and [authenticated same-origin requests](https://clerk.com/docs/guides/development/making-requests).
