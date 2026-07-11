import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleEvaluate } from "./_lib/handler";

/** API-1: the single endpoint. POST /api/evaluate { text } */
export default async function evaluate(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== "POST") {
    response
      .status(405)
      .json({ error: "that method isn't supported", hint: 'POST JSON like { "text": "convection oven" }' });
    return;
  }
  const forwarded = request.headers["x-forwarded-for"];
  const clientIp =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0].trim() ??
    request.socket.remoteAddress ??
    "unknown";
  const { status, body } = await handleEvaluate(request.body, clientIp);
  response.status(status).json(body);
}
