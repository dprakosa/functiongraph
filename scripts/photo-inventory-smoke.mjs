import { readFile } from "node:fs/promises";
import { createClerkClient } from "@clerk/backend";

const ACTIVE_DOMAINS = new Set([
  "kitchen",
  "electronics",
  "garage",
  "bathroom",
]);
const FIXTURE_URL = new URL(
  "../tests/fixtures/kitchen-inventory.webp",
  import.meta.url,
);

class SmokeFailure extends Error {
  constructor(readonlyReason, status = null) {
    super(readonlyReason);
    this.name = "SmokeFailure";
    this.reason = readonlyReason;
    this.status = status;
  }
}

function requireEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new SmokeFailure(`missing-${name.toLowerCase()}`);
  return value;
}

function previewBaseUrl() {
  const raw = requireEnvironment("PHOTO_SMOKE_BASE_URL");
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new SmokeFailure("invalid-preview-url");
  }
  if (
    url.protocol !== "https:" ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !url.hostname.endsWith(".vercel.app") ||
    !url.hostname.includes("-git-")
  ) {
    throw new SmokeFailure("preview-branch-url-required");
  }
  return url.origin;
}

function log(event, details = {}) {
  console.log(JSON.stringify({ event, ...details }));
}

function elapsed(started) {
  return Math.round(performance.now() - started);
}

function assertStatus(result, expected, operation) {
  if (result.status !== expected) {
    throw new SmokeFailure(`${operation}-status`, result.status);
  }
}

function assertNoStore(result, operation) {
  if (!result.cacheControl?.includes("no-store")) {
    throw new SmokeFailure(`${operation}-cache-control`, result.status);
  }
}

function scanFailureReason(body) {
  const error = typeof body?.error === "string" ? body.error : "";
  if (/authentication|sign in/i.test(error)) return "inventory-scan-auth";
  if (/configured|requires an immutable|requires a pinned/i.test(error)) {
    return "inventory-scan-config";
  }
  if (/invalid data/i.test(error)) return "inventory-scan-provider-data";
  if (/temporarily unavailable/i.test(error)) return "inventory-scan-database";
  if (/too many/i.test(error)) return "inventory-scan-rate-limit";
  if (/busy/i.test(error)) return "inventory-scan-provider-busy";
  if (/didn't respond/i.test(error)) return "inventory-scan-provider-unavailable";
  if (/couldn't be used/i.test(error)) return "inventory-scan-refused";
  return "inventory-scan-status";
}

async function wait(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main() {
  if (process.env.LIVE_PHOTO_SMOKE !== "1") {
    throw new SmokeFailure("live-smoke-opt-in-required");
  }

  const baseUrl = previewBaseUrl();
  const clerk = createClerkClient({
    secretKey: requireEnvironment("CLERK_SECRET_KEY"),
  });
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const image = await readFile(FIXTURE_URL);
  const imageDataUrl = `data:image/webp;base64,${image.toString("base64")}`;

  const users = [];
  let itemId = null;
  let ownerSessionId = null;

  async function requestJson(operation, path, options = {}) {
    const started = performance.now();
    const headers = {
      accept: "application/json",
      origin: baseUrl,
      ...(bypass ? { "x-vercel-protection-bypass": bypass } : {}),
      ...(options.token
        ? { authorization: `Bearer ${options.token}` }
        : {}),
      ...(options.body ? { "content-type": "application/json" } : {}),
    };
    let response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method: options.method ?? "GET",
        headers,
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
        signal: AbortSignal.timeout(options.timeout ?? 45_000),
      });
    } catch {
      throw new SmokeFailure(`${operation}-network`);
    }

    let body = null;
    if (response.status !== 204) {
      try {
        body = await response.json();
      } catch {
        throw new SmokeFailure(`${operation}-json`, response.status);
      }
    }
    const result = {
      status: response.status,
      body,
      cacheControl: response.headers.get("cache-control"),
      ms: elapsed(started),
    };
    log(operation, { status: result.status, ms: result.ms });
    return result;
  }

  async function createUser(suffix) {
    const started = performance.now();
    try {
      const user = await clerk.users.createUser({
        emailAddress: [
          `functiongraph+clerk_test_${runId}_${suffix}@example.com`,
        ],
        firstName: "FunctionGraph",
        lastName: "Smoke",
        skipPasswordRequirement: true,
        skipLegalChecks: true,
        privateMetadata: { functiongraphSmokeRun: runId },
      });
      users.push(user.id);
      log("clerk.user.created", { status: 201, ms: elapsed(started) });
      return user;
    } catch {
      throw new SmokeFailure("clerk-user-create");
    }
  }

  async function createSession(userId) {
    const started = performance.now();
    try {
      const session = await clerk.sessions.createSession({ userId });
      log("clerk.session.created", { status: 201, ms: elapsed(started) });
      return session;
    } catch {
      throw new SmokeFailure("clerk-session-create");
    }
  }

  async function sessionToken(sessionId) {
    try {
      return (await clerk.sessions.getToken(sessionId)).jwt;
    } catch {
      throw new SmokeFailure("clerk-session-token");
    }
  }

  async function scanWithOneTransientRetry(token) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const result = await requestJson("inventory.scan", "/api/inventory/scan", {
        method: "POST",
        token,
        body: { imageDataUrl, roomHint: "kitchen" },
      });
      if (result.status === 200) return result;
      if ((result.status === 429 || result.status === 503) && attempt === 1) {
        log("inventory.scan.retry", { status: result.status, ms: 1_500 });
        await wait(1_500);
        continue;
      }
      return result;
    }
    throw new SmokeFailure("inventory-scan-retry");
  }

  try {
    const signedOutInventory = await requestJson(
      "signed-out.inventory",
      "/api/inventory/items",
    );
    assertStatus(signedOutInventory, 401, "signed-out-inventory");
    assertNoStore(signedOutInventory, "signed-out-inventory");

    const signedOutScan = await requestJson(
      "signed-out.scan",
      "/api/inventory/scan",
      {
        method: "POST",
        body: { imageDataUrl: "data:image/webp;base64,AAAA" },
      },
    );
    assertStatus(signedOutScan, 401, "signed-out-scan");
    assertNoStore(signedOutScan, "signed-out-scan");

    const [userA, userB] = await Promise.all([
      createUser("owner"),
      createUser("other"),
    ]);
    const [sessionA, sessionB] = await Promise.all([
      createSession(userA.id),
      createSession(userB.id),
    ]);
    ownerSessionId = sessionA.id;
    let tokenA = await sessionToken(sessionA.id);
    const tokenB = await sessionToken(sessionB.id);

    const scan = await scanWithOneTransientRetry(tokenA);
    if (scan.status !== 200) {
      throw new SmokeFailure(scanFailureReason(scan.body), scan.status);
    }
    assertNoStore(scan, "inventory-scan");
    const candidates = Array.isArray(scan.body?.items) ? scan.body.items : [];
    log("inventory.scan.candidates", { status: 200, count: candidates.length });
    if (candidates.length === 0) {
      throw new SmokeFailure("inventory-scan-empty", scan.status);
    }
    const candidate =
      candidates.find((item) =>
        item?.capabilities?.some(
          (capability) => capability?.name === "toasts bread",
        ),
      ) ?? candidates.find((item) => /toaster/i.test(item?.name ?? ""));
    if (
      !candidate ||
      typeof candidate.name !== "string" ||
      !Array.isArray(candidate.capabilities) ||
      candidate.capabilities.length === 0
    ) {
      throw new SmokeFailure("toaster-candidate-missing", scan.status);
    }

    const confirmationBody = {
      items: [
        {
          name: candidate.name,
          domain: ACTIVE_DOMAINS.has(candidate.suggestedDomain)
            ? candidate.suggestedDomain
            : "kitchen",
          quantity:
            Number.isSafeInteger(candidate.quantity) && candidate.quantity > 0
              ? candidate.quantity
              : 1,
          capabilities: candidate.capabilities,
        },
      ],
    };
    const confirmed = await requestJson(
      "inventory.confirm",
      "/api/inventory/items",
      { method: "POST", token: tokenA, body: confirmationBody },
    );
    assertStatus(confirmed, 201, "inventory-confirm");
    assertNoStore(confirmed, "inventory-confirm");
    itemId = confirmed.body?.items?.[0]?.id ?? null;
    if (typeof itemId !== "string") {
      throw new SmokeFailure("inventory-confirm-id", confirmed.status);
    }
    log("inventory.confirmed", { status: 201, count: 1, itemId });

    const ownerReload = await requestJson(
      "inventory.owner.reload",
      "/api/inventory/items",
      { token: tokenA },
    );
    assertStatus(ownerReload, 200, "inventory-owner-reload");
    assertNoStore(ownerReload, "inventory-owner-reload");
    if (!ownerReload.body?.items?.some((item) => item?.id === itemId)) {
      throw new SmokeFailure("inventory-owner-item-missing", ownerReload.status);
    }

    const otherReload = await requestJson(
      "inventory.other.reload",
      "/api/inventory/items",
      { token: tokenB },
    );
    assertStatus(otherReload, 200, "inventory-other-reload");
    if (otherReload.body?.items?.some((item) => item?.id === itemId)) {
      throw new SmokeFailure("inventory-cross-user-read", otherReload.status);
    }

    const foreignPatch = await requestJson(
      "inventory.other.patch",
      `/api/inventory/items/${itemId}`,
      { method: "PATCH", token: tokenB, body: { quantity: 2 } },
    );
    assertStatus(foreignPatch, 404, "inventory-cross-user-patch");
    const foreignDelete = await requestJson(
      "inventory.other.delete",
      `/api/inventory/items/${itemId}`,
      { method: "DELETE", token: tokenB },
    );
    assertStatus(foreignDelete, 404, "inventory-cross-user-delete");

    tokenA = await sessionToken(sessionA.id);
    const confirmedFunctions = candidate.capabilities
      .map((capability) => capability.name)
      .join(", ");
    const evaluation = await requestJson("evaluation.inventory", "/api/evaluate", {
      method: "POST",
      token: tokenA,
      body: {
        text: `A basic household toaster. Existing functions: ${confirmedFunctions}.`,
      },
    });
    assertStatus(evaluation, 200, "evaluation-inventory");
    assertNoStore(evaluation, "evaluation-inventory");
    const coveredByConfirmedItem = evaluation.body?.verdict?.rows?.some(
      (row) => row?.covered && row?.bestCoverer === candidate.name,
    );
    if (!coveredByConfirmedItem) {
      throw new SmokeFailure("evaluation-inventory-not-used", evaluation.status);
    }

    const updated = await requestJson(
      "inventory.owner.patch",
      `/api/inventory/items/${itemId}`,
      {
        method: "PATCH",
        token: tokenA,
        body: { name: "Smoke-test toaster", domain: "kitchen", quantity: 2 },
      },
    );
    assertStatus(updated, 200, "inventory-owner-patch");
    if (
      updated.body?.item?.name !== "Smoke-test toaster" ||
      updated.body?.item?.quantity !== 2
    ) {
      throw new SmokeFailure("inventory-owner-patch-body", updated.status);
    }

    const editReload = await requestJson(
      "inventory.edit.reload",
      "/api/inventory/items",
      { token: tokenA },
    );
    assertStatus(editReload, 200, "inventory-edit-reload");
    const reloaded = editReload.body?.items?.find((item) => item?.id === itemId);
    if (reloaded?.name !== "Smoke-test toaster" || reloaded?.quantity !== 2) {
      throw new SmokeFailure("inventory-edit-not-persisted", editReload.status);
    }

    const deletedItemId = itemId;
    const deleted = await requestJson(
      "inventory.owner.delete",
      `/api/inventory/items/${deletedItemId}`,
      { method: "DELETE", token: tokenA },
    );
    assertStatus(deleted, 204, "inventory-owner-delete");
    itemId = null;

    const deleteReload = await requestJson(
      "inventory.delete.reload",
      "/api/inventory/items",
      { token: tokenA },
    );
    assertStatus(deleteReload, 200, "inventory-delete-reload");
    if (deleteReload.body?.items?.some((item) => item?.id === deletedItemId)) {
      throw new SmokeFailure("inventory-delete-not-persisted", deleteReload.status);
    }

    log("smoke.complete", { status: 200, count: candidates.length });
  } finally {
    if (itemId && ownerSessionId) {
      try {
        const cleanupToken = await sessionToken(ownerSessionId);
        const cleanup = await requestJson(
          "cleanup.inventory",
          `/api/inventory/items/${itemId}`,
          { method: "DELETE", token: cleanupToken },
        );
        if (cleanup.status !== 204 && cleanup.status !== 404) {
          log("cleanup.inventory.failed", { status: cleanup.status });
        }
      } catch {
        log("cleanup.inventory.failed", { status: 0 });
      }
    }

    for (const userId of users.reverse()) {
      const started = performance.now();
      try {
        await clerk.users.deleteUser(userId);
        log("cleanup.clerk-user", { status: 200, ms: elapsed(started) });
      } catch {
        log("cleanup.clerk-user.failed", { status: 0, ms: elapsed(started) });
      }
    }
  }
}

main().catch((error) => {
  const known = error instanceof SmokeFailure;
  console.error(
    JSON.stringify({
      event: "smoke.failed",
      status: known ? error.status : null,
      reason: known ? error.reason : "unexpected",
    }),
  );
  process.exitCode = 1;
});
