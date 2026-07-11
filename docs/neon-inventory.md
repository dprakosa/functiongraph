# Clerk-scoped Neon inventory

FunctionGraph stores only confirmed personal inventory fields in Neon Postgres.
The Vercel Marketplace resource is named `functiongraph-inventory`; Neon Auth is
disabled because Clerk remains the identity authority.

## Security and data boundary

- `DATABASE_URL` and `DATABASE_URL_UNPOOLED` are server-only. Never create a
  `VITE_` alias or return either value from an API.
- The Clerk user ID comes only from the verified server request. The client
  cannot choose an owner ID.
- Every select, update, and delete includes `clerk_user_id`; the same not-found
  response covers missing and foreign rows.
- Only reviewed name, room, quantity, canonical capabilities, and the `photo`
  source are stored. Images, data URLs, provider output, candidate ids,
  evidence, confidence, and warnings are never persisted.
- Batch confirmation is one multi-row Postgres statement after the entire body
  validates, so a constraint failure rolls back every row.

## Schema and migrations

The Drizzle schema lives in `api/_lib/inventorySchema.ts`; committed SQL lives
under `drizzle/`. After an intentional schema edit:

```sh
npm run db:generate
git diff -- drizzle api/_lib/inventorySchema.ts
```

Apply committed migrations to the linked Vercel development environment:

```sh
vercel env run -e development -- npm run db:migrate
```

Drizzle records applied migrations in the database, so rerunning the command is
safe. Do not edit an already-applied SQL migration; add a new migration.

The committed Vercel build command is:

```sh
npm run db:migrate && npm run build
```

This applies migrations before compiling the functions that use them.

## Local development

Link the repository to the `functiongraph` Vercel project, install exact
dependencies, migrate, and use Vercel's function runtime:

```sh
vercel link
npm ci
vercel env run -e development -- npm run db:migrate
vercel dev
```

Plain `npm run dev` still provides the guest evaluation convenience route, but
it does not emulate Clerk-protected nested APIs. Do not commit `.env` or
`.env.local`.

## Isolated database integration tests

The integration suite refuses any database name except `functiongraph_test`.
The setup command creates that database beside the development database when
needed, applies migrations, runs tenant isolation and transactional rollback
tests, and removes its generated rows:

```sh
vercel env run -e development -- npm run test:db
```

CI may instead provide an explicit `TEST_DATABASE_URL`, but it must end in
`/functiongraph_test`. Never map this variable to a production database.

## Preview deployments

In the Vercel Neon resource connection, enable all of the following:

1. Preview environment access.
2. **Required** deployment integration.
3. **Create a database branch for deployment: Preview**.
4. Automatic deletion of obsolete preview branches.

Each preview then receives branch-specific database URLs before its build, and
the build migrates that branch. Verify a deployment without printing a full
connection string: compare only its database host/branch identifier with the
development or production host.

## Production and rollback

Production deployment applies only forward, committed migrations. Prefer
expand/contract changes: add compatible columns or tables first, deploy code
that can use both shapes, and remove obsolete schema in a later release.

Before a destructive migration, create a Neon restore point or branch. If an
application deploy fails, roll the application back only when the prior code is
compatible with the new schema. For a data/schema incident, restore or branch
from Neon's point-in-time history rather than editing Drizzle's migration
journal. Never run the isolated test setup against production.

## Clerk user deletion

Configure a public Clerk webhook endpoint for the `user.deleted` event:

```text
https://YOUR_DEPLOYMENT/api/webhooks/clerk
```

Copy its signing secret into the server-only
`CLERK_WEBHOOK_SIGNING_SECRET` variable for the matching Vercel environment,
then redeploy. The function verifies the raw signed request before deleting all
inventory rows for the event's Clerk user ID. A Neon failure returns a non-2xx
response so Clerk can retry.

## Optional read-only agent tools

Vercel and Neon MCP access is useful for inspecting deployments and schema
without putting database credentials in prompts. Keep Neon read-only; schema
changes still go through committed migrations:

```sh
codex mcp add vercel --url https://mcp.vercel.com
codex mcp login vercel
codex mcp add neon --url 'https://mcp.neon.tech/mcp?readonly=true&category=querying&category=schema'
codex mcp login neon --scopes read
```

Restart the Codex thread after adding a server so its tools are loaded.
