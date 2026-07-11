import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateApiRequest } from "../_lib/auth.js";
import {
  InventoryStoreUnavailableError,
  listInventoryItems,
} from "../_lib/inventoryStore.js";
import { handleInventoryScan } from "../_lib/scanInventory.js";

/** API-7: authenticated, ephemeral photo-to-inventory draft. */
export default async function scanInventory(
  request: VercelRequest,
  response: VercelResponse,
) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.status(405).json({
      error: "that method isn't supported",
      hint: 'POST JSON like { "imageDataUrl": "data:image/jpeg;base64,..." }',
    });
    return;
  }

  try {
    const authentication = await authenticateApiRequest(request);
    if (!authentication.ok) {
      response.status(authentication.status).json(authentication.body);
      return;
    }
    const items = await listInventoryItems(authentication.userId);
    const { status, body } = await handleInventoryScan(
      request.body,
      authentication.userId,
      items,
    );
    response.status(status).json(body);
  } catch (error) {
    if (error instanceof InventoryStoreUnavailableError) {
      response.status(503).json({
        error: "personal inventory is temporarily unavailable",
        hint: "wait a moment and try the photo scan again",
      });
      return;
    }
    response.status(500).json({
      error: "photo scanning failed unexpectedly",
      hint: "try again with a clear JPEG, PNG, or WebP photo",
    });
  }
}
