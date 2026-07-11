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

Use a Vercel Git Preview branch deployment, never Production. The branch must
have its own Neon preview database and these configured Preview variables:

- Clerk publishable/secret keys and authorized parties for the development
  instance.
- Neon `DATABASE_URL` supplied by the Vercel integration.
- Pinned `OPENAI_MODEL`, `OPENAI_VISION_MODEL`, `OPENAI_EMBED_MODEL`, and
  `OPENAI_EMBED_REVISION`, plus `OPENAI_API_KEY`.

The local command needs only the matching Clerk development secret and the
branch alias. Set secrets in the shell or an approved secret manager; never
paste them into issues, logs, or command history.

```sh
export LIVE_PHOTO_SMOKE=1
export PHOTO_SMOKE_BASE_URL=https://functiongraph-git-your-branch-team.vercel.app
export CLERK_SECRET_KEY=sk_test_...
npm run test:photo:live
```

If Vercel Deployment Protection is enabled, also set
`VERCEL_AUTOMATION_BYPASS_SECRET` locally. The script passes it only as the
documented protection-bypass header and never prints it.

## Workflow and cleanup

The script checks sanitized signed-out responses, creates two synthetic Clerk
users and sessions, scans the fixture, confirms one toaster candidate, reloads
it, proves the cached oven verdict uses that inventory, checks cross-user
read/update/delete isolation, edits and reloads, then deletes and reloads.

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
