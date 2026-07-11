import { createClerkClient } from "@clerk/backend";
import type { VercelRequest } from "@vercel/node";
import type { EvaluateError } from "../../src/lib/types.js";

export type AuthOutcome =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 503; body: EvaluateError };

type AuthConfig = {
  publishableKey: string;
  secretKey: string;
  authorizedParties: string[];
};

const UNAUTHENTICATED: AuthOutcome = {
  ok: false,
  status: 401,
  body: {
    error: "sign in to evaluate a live product",
    hint: "sign in and try again, or tap an example — those never touch the network",
  },
};

const AUTH_NOT_CONFIGURED: AuthOutcome = {
  ok: false,
  status: 503,
  body: {
    error: "live evaluation authentication isn't configured",
    hint: "configure Clerk on the server, or tap an example — those never touch the network",
  },
};

const AUTH_UNAVAILABLE: AuthOutcome = {
  ok: false,
  status: 503,
  body: {
    error: "sign-in verification is temporarily unavailable",
    hint: "try again in a moment, or tap an example — those never touch the network",
  },
};

// authenticateRequest reports these verifier/configuration failures as a
// signed-out state. They are service failures, not bad credentials from a user.
const VERIFIER_FAILURE_REASONS = new Set([
  "unexpected-error",
  "secret-key-invalid",
  "jwk-local-missing",
  "jwk-remote-failed-to-load",
  "jwk-remote-invalid",
  "jwk-remote-missing",
  "jwk-failed-to-resolve",
]);

function keyEnvironment(
  value: string,
  kind: "pk" | "sk",
): "test" | "live" | null {
  const match = new RegExp(`^${kind}_(test|live)_\\S+$`).exec(value);
  return (match?.[1] as "test" | "live" | undefined) ?? null;
}

function parseAuthorizedParties(value: string): string[] | null {
  const entries = value.split(",").map((entry) => entry.trim());
  if (entries.length === 0 || entries.some((entry) => !entry)) return null;

  const parties: string[] = [];
  for (const entry of entries) {
    let url: URL;
    try {
      url = new URL(entry);
    } catch {
      return null;
    }

    const isHttpOrigin = url.protocol === "http:" || url.protocol === "https:";
    const hasOnlyOrigin =
      url.pathname === "/" &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password;
    if (
      !isHttpOrigin ||
      !hasOnlyOrigin ||
      url.origin === "null" ||
      url.hostname.includes("*") ||
      entry !== url.origin
    ) {
      return null;
    }

    if (!parties.includes(url.origin)) parties.push(url.origin);
  }

  return parties;
}

function loadAuthConfig(): AuthConfig | null {
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY?.trim() ?? "";
  const secretKey = process.env.CLERK_SECRET_KEY?.trim() ?? "";
  const rawAuthorizedParties =
    process.env.CLERK_AUTHORIZED_PARTIES?.trim() ?? "";

  const publishableEnvironment = keyEnvironment(publishableKey, "pk");
  const secretEnvironment = keyEnvironment(secretKey, "sk");
  const authorizedParties = parseAuthorizedParties(rawAuthorizedParties);

  if (
    !publishableEnvironment ||
    !secretEnvironment ||
    publishableEnvironment !== secretEnvironment ||
    !authorizedParties
  ) {
    return null;
  }

  return { publishableKey, secretKey, authorizedParties };
}

function firstHeaderValue(value: string | null): string | undefined {
  return value?.split(",", 1)[0]?.trim() || undefined;
}

function authorizationToken(headers: Headers): string | undefined {
  const authorization = headers.get("authorization");
  if (!authorization) return undefined;

  // Match Clerk's header parsing: a bare value is treated as the token, while
  // a two-part value is accepted only for the exact Bearer scheme.
  const [scheme, token] = authorization.split(" ", 2);
  if (!token) return scheme;
  return scheme === "Bearer" ? token : undefined;
}

function cookieSessionTokens(headers: Headers): {
  unsuffixed?: string;
  suffixed: string[];
} {
  const cookie = headers.get("cookie");
  if (!cookie) return { suffixed: [] };

  let unsuffixed: string | undefined;
  const suffixed: string[] = [];
  for (const entry of cookie.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 0) continue;
    const name = entry.slice(0, separator).trim();
    const rawValue = entry.slice(separator + 1).trim();
    if (!rawValue) continue;
    let value = rawValue;
    try {
      value = decodeURIComponent(rawValue);
    } catch {
      // Leave malformed encoding intact so the JWT shape check rejects it.
    }
    if (name === "__session") unsuffixed ??= value;
    else if (name.startsWith("__session_")) suffixed.push(value);
  }
  return { unsuffixed, suffixed };
}

function isStructuredJwt(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3 || !/^[A-Za-z0-9_-]+$/.test(parts[2])) return false;

  return parts.slice(0, 2).every((part) => {
    if (!/^[A-Za-z0-9_-]+$/.test(part)) return false;
    try {
      const value: unknown = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
      return Boolean(value) && typeof value === "object" && !Array.isArray(value);
    } catch {
      return false;
    }
  });
}

function hasOnlyMalformedSessionTokens(headers: Headers): boolean {
  // This is only a syntax gate for stable 401s. Clerk still performs every
  // signature, expiry, issuer, session-status, and authorized-party check.
  const headerToken = authorizationToken(headers);
  if (headerToken !== undefined) return !isStructuredJwt(headerToken);

  const cookieTokens = cookieSessionTokens(headers);
  if (cookieTokens.unsuffixed !== undefined) {
    return !isStructuredJwt(cookieTokens.unsuffixed);
  }
  return (
    cookieTokens.suffixed.length > 0 &&
    cookieTokens.suffixed.every((token) => !isStructuredJwt(token))
  );
}

function toWebRequest(request: VercelRequest): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (value !== undefined) {
      headers.append(name, value);
    }
  }

  const rawUrl = request.url ?? "/";
  let absoluteUrl: URL;
  try {
    absoluteUrl = new URL(rawUrl);
  } catch {
    const forwardedProtocol = firstHeaderValue(
      headers.get("x-forwarded-proto"),
    );
    const socketIsEncrypted = Boolean(
      (request.socket as typeof request.socket & { encrypted?: boolean })
        ?.encrypted,
    );
    const protocol =
      forwardedProtocol === "http" || forwardedProtocol === "https"
        ? forwardedProtocol
        : socketIsEncrypted
          ? "https"
          : "http";
    const host =
      firstHeaderValue(headers.get("x-forwarded-host")) ??
      firstHeaderValue(headers.get("host")) ??
      "localhost";
    absoluteUrl = new URL(rawUrl, `${protocol}://${host}`);
  }

  return new Request(absoluteUrl, {
    method: request.method ?? "GET",
    headers,
  });
}

/** Authenticate a server-side live feature and return its stable Clerk user id. */
export async function authenticateApiRequest(
  request: VercelRequest,
): Promise<AuthOutcome> {
  const config = loadAuthConfig();
  if (!config) return AUTH_NOT_CONFIGURED;

  let webRequest: Request;
  try {
    webRequest = toWebRequest(request);
  } catch {
    return AUTH_UNAVAILABLE;
  }
  if (hasOnlyMalformedSessionTokens(webRequest.headers)) {
    return UNAUTHENTICATED;
  }

  try {
    const clerk = createClerkClient({
      publishableKey: config.publishableKey,
      secretKey: config.secretKey,
    });
    const state = await clerk.authenticateRequest(webRequest, {
      acceptsToken: "session_token",
      authorizedParties: config.authorizedParties,
    });

    if (state.isAuthenticated && state.tokenType === "session_token") {
      const auth = state.toAuth({ treatPendingAsSignedOut: true });
      return auth.isAuthenticated && auth.userId
        ? { ok: true, userId: auth.userId }
        : UNAUTHENTICATED;
    }
    if (state.reason && VERIFIER_FAILURE_REASONS.has(state.reason)) {
      return AUTH_UNAVAILABLE;
    }
    return UNAUTHENTICATED;
  } catch {
    // Clerk configuration/JWKS errors can contain key material and request
    // details, so expose only a stable, actionable PDD-shaped response.
    return AUTH_UNAVAILABLE;
  }
}

/** Backwards-compatible name for the existing evaluate wrapper. */
export const authenticateEvaluateRequest = authenticateApiRequest;
