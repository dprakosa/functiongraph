# Photo inventory Preview smoke test

This opt-in backend smoke test proves the real Clerk → Vercel Function →
OpenAI vision → Neon inventory → evaluation path without interacting with the
unfinished photo-review UI. Ordinary `npm test` remains deterministic and
never calls Clerk, OpenAI, Vercel, or Neon.

## Safe fixture

`tests/fixtures/kitchen-inventory.webp` is repository-owned synthetic imagery
generated with the built-in image-generation tool for this test. It contains
an unbranded toaster with bread, kettle, and mug on a neutral counter. It has
no people, documents, screens, readable text, logos, private information,
location clues, or third-party artwork. Sharp converted it to WebP and removed
EXIF, ICC, IPTC, and XMP metadata.

Generation prompt:

> Create a realistic household kitchen photo containing one clearly
> recognizable plain two-slot toaster as the dominant foreground object, with
> two slices of bread inserted, plus a simple electric kettle and an unbranded
> ceramic mug nearby. Use a clean neutral countertop and backsplash, soft
> daylight, and clear object boundaries. Include no people, hands, documents,
> screens, labels, logos, readable text, serial numbers, private information,
> location clues, artwork, or watermark.

The fixture contract test pins its SHA-256 digest and verifies its format,
dimensions, decoded size, and absence of embedded metadata.

## Required setup

Use a Vercel Git Preview branch deployment for routine smoke runs. The branch
must have its own Neon preview database and these configured Preview variables:

- Clerk publishable/secret keys and authorized parties for the development
  instance.
- Neon `DATABASE_URL` supplied by the Vercel integration.
- Pinned `OPENAI_MODEL`, `OPENAI_VISION_MODEL`, `OPENAI_EMBED_MODEL`, and
  `OPENAI_EMBED_REVISION`, plus `OPENAI_API_KEY`.

The local command needs only the matching Clerk development secret and the
branch alias. Set secrets in the shell or an approved secret manager; never
paste them into issues, logs, or command history.

Because `CLERK_AUTHORIZED_PARTIES` accepts exact origins rather than
wildcards, add a branch-scoped Preview override containing localhost and this
Preview's persistent branch alias, then redeploy the Git branch:

```sh
vercel env add CLERK_AUTHORIZED_PARTIES preview YOUR_GIT_BRANCH \
  --value 'http://localhost:5173,https://YOUR_BRANCH_ALIAS.vercel.app' \
  --yes --no-sensitive
```

```sh
export LIVE_PHOTO_SMOKE=1
export PHOTO_SMOKE_BASE_URL=https://functiongraph-git-your-branch-team.vercel.app
export CLERK_SECRET_KEY=sk_test_...
npm run test:photo:live
```

## Production release verification

Production verification is intentionally double opt-in and accepts only the
canonical `https://www.subgraph.works` origin. Run it only for an explicit release
check approved by the project owner. It creates disposable Clerk users and one
temporary inventory row in Production, exercises the real OpenAI path, and
removes them in `finally` cleanup:

```sh
vercel env run -e production -- sh -c \
  'LIVE_PHOTO_SMOKE=1 LIVE_PHOTO_SMOKE_PRODUCTION=1 \
  PHOTO_SMOKE_BASE_URL=https://www.subgraph.works npm run test:photo:live'
```

Do not set `LIVE_PHOTO_SMOKE_PRODUCTION` in CI or a persistent environment.
The exact-origin guard prevents this mode from targeting a Preview, generated
deployment URL, or unrelated Production domain.

If Vercel Deployment Protection is enabled, also set
`VERCEL_AUTOMATION_BYPASS_SECRET` locally. The script passes it only as the
documented protection-bypass header and never prints it.

## Workflow and cleanup

The script checks sanitized signed-out responses, creates two synthetic Clerk
users and Backend API sessions, scans the fixture, confirms one toaster candidate, reloads
it, runs a live toaster evaluation against the confirmed function vocabulary,
proves the verdict names that stored item as a coverer, checks cross-user
read/update/delete isolation, edits and reloads, then deletes and reloads.

Clerk Backend API session tokens are sent only in the `Authorization` header.
Those server-created tokens do not contain the browser-origin `azp` claim;
the API still verifies their signature, issuer, expiry, active session, and
session-token type. Browser cookie sessions and browser-created bearer tokens
retain the exact `CLERK_AUTHORIZED_PARTIES` check.

Confirmation is never retried, avoiding duplicate writes. A scan may retry
once after a transient `429` or `503`. The `finally` path deletes a confirmed
item when necessary and deletes every synthetic Clerk user even after failure;
the configured `user.deleted` webhook provides the secondary Neon cleanup.

Logs contain only operation names, HTTP statuses, timings, candidate counts,
and generated item IDs. They never include tokens, image bytes/data URLs,
candidate evidence, provider output, secrets, or database connection strings.

## Troubleshooting

- `preview-branch-url-required`: use the persistent `-git-` branch alias, not
  the production domain or a commit-specific URL.
- `401` after user creation: confirm the local Clerk secret matches the Clerk
  keys configured on that Preview.
- `503` from scan: verify the pinned OpenAI variables and the Preview Neon
  migration. The script retries one transient scan failure.
- Vercel authentication page instead of JSON: configure an automation bypass
  secret and set it locally for this command.
- Cleanup warning: delete any synthetic user carrying private metadata key
  `functiongraphSmokeRun` in the Clerk development dashboard; the deletion
  webhook will remove its Neon inventory.
