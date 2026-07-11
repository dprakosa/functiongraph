import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateInventoryRequest } from "../../_lib/auth.js";
import { handleInventoryItem } from "../../_lib/inventoryHandler.js";

export default async function inventoryItem(
  request: VercelRequest,
  response: VercelResponse,
) {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("Allow", "PATCH, DELETE");

  if (request.method !== "PATCH" && request.method !== "DELETE") {
    response.status(405).json({
      error: "that method isn't supported",
      hint: "use PATCH to edit the item or DELETE to remove it",
    });
    return;
  }

  try {
    const authentication = await authenticateInventoryRequest(request);
    if (!authentication.ok) {
      response.status(authentication.status).json(authentication.body);
      return;
    }
    const rawId = Array.isArray(request.query.id)
      ? request.query.id[0]
      : request.query.id;
    const result = await handleInventoryItem(
      request.method,
      rawId,
      request.body,
      authentication.userId,
    );
    if (result.status === 204) {
      response.status(204).end();
      return;
    }
    response.status(result.status).json(result.body);
  } catch {
    response.status(500).json({
      error: "personal inventory failed unexpectedly",
      hint: "wait a moment and try loading your inventory again",
    });
  }
}
