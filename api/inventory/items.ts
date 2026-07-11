import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateInventoryRequest } from "../_lib/auth.js";
import { handleInventoryCollection } from "../_lib/inventoryHandler.js";

export default async function inventoryItems(
  request: VercelRequest,
  response: VercelResponse,
) {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("Allow", "GET, POST");

  if (request.method !== "GET" && request.method !== "POST") {
    response.status(405).json({
      error: "that method isn't supported",
      hint: "use GET to load inventory or POST to confirm reviewed items",
    });
    return;
  }

  try {
    const authentication = await authenticateInventoryRequest(request);
    if (!authentication.ok) {
      response.status(authentication.status).json(authentication.body);
      return;
    }
    const result = await handleInventoryCollection(
      request.method,
      request.body,
      authentication.userId,
    );
    response.status(result.status).json(result.body);
  } catch {
    response.status(500).json({
      error: "personal inventory failed unexpectedly",
      hint: "wait a moment and try loading your inventory again",
    });
  }
}
