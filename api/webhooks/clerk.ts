import { verifyWebhook } from "@clerk/backend/webhooks";
import {
  deleteInventoryForUser,
  InventoryStoreUnavailableError,
} from "../_lib/inventoryStore.js";

export async function POST(request: Request): Promise<Response> {
  let event: Awaited<ReturnType<typeof verifyWebhook>>;
  try {
    event = await verifyWebhook(request);
  } catch {
    return Response.json(
      { error: "webhook verification failed" },
      { status: 400 },
    );
  }

  if (event.type !== "user.deleted") {
    return new Response(null, { status: 204 });
  }
  if (typeof event.data.id !== "string" || !event.data.id) {
    return Response.json(
      { error: "deleted user id is missing" },
      { status: 400 },
    );
  }

  try {
    await deleteInventoryForUser(event.data.id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return Response.json(
      { error: "inventory cleanup is temporarily unavailable" },
      { status: error instanceof InventoryStoreUnavailableError ? 503 : 500 },
    );
  }
}
