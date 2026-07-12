import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateEvaluateRequest } from "./_lib/auth.js";
import { handleEvaluate } from "./_lib/handler.js";
import {
  InventoryStoreUnavailableError,
  listInventoryItems,
} from "./_lib/inventoryStore.js";

/** API-1: product evaluation endpoint. POST /api/evaluate { text } */
export default async function evaluate(
  request: VercelRequest,
  response: VercelResponse,
) {
  response.setHeader("Cache-Control", "private, no-store");
  if (request.method !== "POST") {
    response
      .status(405)
      .json({ error: "that method isn't supported", hint: 'POST JSON like { "text": "convection oven" }' });
    return;
  }

  try {
    const authentication = await authenticateEvaluateRequest(request);
    if (!authentication.ok) {
      response.status(authentication.status).json(authentication.body);
      return;
    }

    const forwarded = request.headers["x-forwarded-for"];
    const clientIp =
      (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0].trim() ??
      request.socket.remoteAddress ??
      "unknown";
    const items = await listInventoryItems(authentication.userId);
    const { status, body } = await handleEvaluate(request.body, clientIp, items);
    response.status(status).json(body);
  } catch (error) {
    if (error instanceof InventoryStoreUnavailableError) {
      response.status(503).json({
        error: "personal inventory is temporarily unavailable",
        hint: "wait a moment and try the evaluation again",
      });
      return;
    }
    // API-5 applies to unexpected production failures too: always return a
    // next step rather than letting the serverless runtime emit an opaque 500.
    response.status(500).json({
      error: "evaluation failed unexpectedly",
      hint: "choose one of the suggested products and try again",
    });
  }
}
