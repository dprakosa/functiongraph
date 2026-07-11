import type { VercelRequest } from "@vercel/node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  createClerkClient: vi.fn(),
}));

vi.mock("@clerk/backend", () => ({
  createClerkClient: mocks.createClerkClient,
}));

import { authenticateEvaluateRequest } from "./auth";

const validConfig = {
  CLERK_PUBLISHABLE_KEY: "pk_test_publishable",
  CLERK_SECRET_KEY: "sk_test_secret",
  CLERK_AUTHORIZED_PARTIES:
    "https://app.example.com, http://localhost:5173",
};

const SESSION_TOKEN =
  "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJpc3MiOiJodHRwczovL2V4YW1wbGUuY2xlcmsuYWNjb3VudHMuZGV2Iiwic3ViIjoidXNlcl90ZXN0IiwiZXhwIjo5OTk5OTk5OTk5fQ." +
  "c2lnbmF0dXJl";

const defaultHeaders = {
  authorization: `Bearer ${SESSION_TOKEN}`,
  cookie: `__session=${SESSION_TOKEN}`,
  host: "internal.example",
  origin: "https://app.example.com",
  "x-forwarded-host": "app.example.com",
  "x-forwarded-proto": "https",
};

function request(
  overrides: Partial<VercelRequest> = {},
): VercelRequest {
  return {
    method: "POST",
    url: "/api/evaluate?source=test",
    headers: defaultHeaders,
    socket: {},
    ...overrides,
  } as unknown as VercelRequest;
}

describe("authenticateEvaluateRequest", () => {
  beforeEach(() => {
    for (const [name, value] of Object.entries(validConfig)) {
      vi.stubEnv(name, value);
    }
    mocks.createClerkClient.mockReturnValue({
      authenticateRequest: mocks.authenticateRequest,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it.each([
    "CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
    "CLERK_AUTHORIZED_PARTIES",
  ] as const)("returns a controlled 503 when %s is missing", async (name) => {
    vi.stubEnv(name, "");

    const outcome = await authenticateEvaluateRequest(request());

    expect(outcome).toMatchObject({ ok: false, status: 503 });
    if (!outcome.ok) {
      expect(outcome.body.hint).toContain("example");
    }
    expect(mocks.createClerkClient).not.toHaveBeenCalled();
  });

  it.each([
    ["a non-origin URL", "https://app.example.com/path"],
    ["a non-HTTP URL", "ftp://app.example.com"],
    ["a wildcard", "https://*.example.com"],
    ["a trailing slash", "https://app.example.com/"],
    ["an empty list entry", "https://app.example.com,"],
  ])("rejects %s in the authorized-parties configuration", async (_, value) => {
    vi.stubEnv("CLERK_AUTHORIZED_PARTIES", value);

    const outcome = await authenticateEvaluateRequest(request());

    expect(outcome).toMatchObject({ ok: false, status: 503 });
    expect(mocks.createClerkClient).not.toHaveBeenCalled();
  });

  it("rejects malformed or mismatched Clerk keys as configuration errors", async () => {
    vi.stubEnv("CLERK_PUBLISHABLE_KEY", "not-a-publishable-key");
    vi.stubEnv("CLERK_SECRET_KEY", "sk_live_wrong-instance");

    const outcome = await authenticateEvaluateRequest(request());

    expect(outcome).toMatchObject({ ok: false, status: 503 });
    expect(mocks.createClerkClient).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", "session-token-and-uat-missing"],
    ["invalid", "token-invalid"],
    ["expired", "session-token-expired"],
  ])("returns 401 for a %s session", async (_, reason) => {
    mocks.authenticateRequest.mockResolvedValue({
      isAuthenticated: false,
      tokenType: "session_token",
      reason,
    });

    const outcome = await authenticateEvaluateRequest(request());

    expect(outcome).toMatchObject({ ok: false, status: 401 });
    if (!outcome.ok) {
      expect(outcome.body).toEqual({
        error: "sign in to evaluate a live product",
        hint: "sign in and try again, or tap an example — those never touch the network",
      });
    }
  });

  it("rejects a non-session token even if a mock reports it authenticated", async () => {
    mocks.authenticateRequest.mockResolvedValue({
      isAuthenticated: true,
      tokenType: "api_key",
      reason: null,
    });

    await expect(authenticateEvaluateRequest(request())).resolves.toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it("accepts an authenticated session", async () => {
    const toAuth = vi.fn(() => ({ isAuthenticated: true, userId: "user_test" }));
    mocks.authenticateRequest.mockResolvedValue({
      isAuthenticated: true,
      tokenType: "session_token",
      reason: null,
      toAuth,
    });

    await expect(authenticateEvaluateRequest(request())).resolves.toEqual({
      ok: true,
      userId: "user_test",
    });
    expect(toAuth).toHaveBeenCalledWith({ treatPendingAsSignedOut: true });
  });

  it("rejects a pending session that Clerk's request state has verified", async () => {
    const toAuth = vi.fn(() => ({ isAuthenticated: false }));
    mocks.authenticateRequest.mockResolvedValue({
      isAuthenticated: true,
      tokenType: "session_token",
      reason: null,
      toAuth,
    });

    await expect(authenticateEvaluateRequest(request())).resolves.toMatchObject({
      ok: false,
      status: 401,
    });
    expect(toAuth).toHaveBeenCalledWith({ treatPendingAsSignedOut: true });
  });

  it("preserves the URL and auth headers and supplies strict Clerk options", async () => {
    mocks.authenticateRequest.mockResolvedValue({
      isAuthenticated: true,
      tokenType: "session_token",
      reason: null,
      toAuth: () => ({ isAuthenticated: true, userId: "user_test" }),
    });

    await authenticateEvaluateRequest(request());

    expect(mocks.createClerkClient).toHaveBeenCalledWith({
      publishableKey: "pk_test_publishable",
      secretKey: "sk_test_secret",
    });
    const [webRequest, options] = mocks.authenticateRequest.mock.calls[0] as [
      Request,
      Record<string, unknown>,
    ];
    expect(webRequest.url).toBe(
      "https://app.example.com/api/evaluate?source=test",
    );
    expect(webRequest.method).toBe("POST");
    expect(webRequest.headers.get("authorization")).toBe(
      `Bearer ${SESSION_TOKEN}`,
    );
    expect(webRequest.headers.get("cookie")).toBe(
      `__session=${SESSION_TOKEN}`,
    );
    expect(webRequest.headers.get("origin")).toBe(
      "https://app.example.com",
    );
    expect(options).toEqual({
      acceptsToken: "session_token",
      authorizedParties: [
        "https://app.example.com",
        "http://localhost:5173",
      ],
    });
  });

  it.each([
    ["a thrown verifier error", new Error("sk_test_secret JWKS failed")],
    [
      "an ambiguous SDK verifier state",
      {
        isAuthenticated: false,
        tokenType: "session_token",
        reason: "unexpected-error",
      },
    ],
    [
      "a verifier failure state",
      {
        isAuthenticated: false,
        tokenType: "session_token",
        reason: "jwk-remote-failed-to-load",
      },
    ],
  ])("returns a secret-safe actionable 503 for %s", async (_, failure) => {
    if (failure instanceof Error) {
      mocks.authenticateRequest.mockRejectedValue(failure);
    } else {
      mocks.authenticateRequest.mockResolvedValue(failure);
    }

    const outcome = await authenticateEvaluateRequest(request());

    expect(outcome).toMatchObject({ ok: false, status: 503 });
    expect(JSON.stringify(outcome)).not.toContain("sk_test_secret");
    expect(JSON.stringify(outcome)).not.toContain("JWKS failed");
    if (!outcome.ok) expect(outcome.body.hint).toContain("try again");
  });

  it.each([
    ["a malformed bearer token", { authorization: "Bearer aaa.bbb.ccc" }],
    ["a malformed bare token", { authorization: "aaa.bbb.ccc" }],
    [
      "a malformed session cookie",
      { authorization: undefined, cookie: "__session=aaa.bbb.ccc" },
    ],
    [
      "a malformed unsuffixed cookie beside another shaped token",
      {
        authorization: undefined,
        cookie: `__session=aaa.bbb.ccc; __session_stale=${SESSION_TOKEN}`,
      },
    ],
  ])("returns 401 before Clerk sees %s", async (_, headerOverrides) => {
    const outcome = await authenticateEvaluateRequest(
      request({ headers: { ...defaultHeaders, ...headerOverrides } }),
    );

    expect(outcome).toMatchObject({ ok: false, status: 401 });
    expect(mocks.createClerkClient).not.toHaveBeenCalled();
    expect(mocks.authenticateRequest).not.toHaveBeenCalled();
  });

  it("accepts the percent-encoded form used by cookie parsing", async () => {
    mocks.authenticateRequest.mockResolvedValue({
      isAuthenticated: true,
      tokenType: "session_token",
      reason: null,
      toAuth: () => ({ isAuthenticated: true, userId: "user_test" }),
    });

    const outcome = await authenticateEvaluateRequest(
      request({
        headers: {
          ...defaultHeaders,
          authorization: undefined,
          cookie: `__session=${SESSION_TOKEN.replaceAll(".", "%2E")}`,
        },
      }),
    );

    expect(outcome).toEqual({ ok: true, userId: "user_test" });
    expect(mocks.authenticateRequest).toHaveBeenCalledOnce();
  });
});
