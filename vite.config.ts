import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vitest/config";
import { handleEvaluate } from "./api/_lib/handler";

/**
 * Serves the same handler the Vercel function wraps, so `npm run dev` has a
 * working /api/evaluate without the Vercel CLI. Edits under api/ need a dev
 * server restart.
 */
function evaluateDevApi(): Plugin {
  return {
    name: "evaluate-dev-api",
    configureServer(server) {
      server.middlewares.use("/api/evaluate", (request, response) => {
        const respond = (status: number, body: unknown) => {
          response.statusCode = status;
          response.setHeader("content-type", "application/json");
          response.end(JSON.stringify(body));
        };
        if (request.method !== "POST") {
          respond(405, {
            error: "that method isn't supported",
            hint: 'POST JSON like { "text": "convection oven" }',
          });
          return;
        }
        let raw = "";
        request.on("data", (chunk) => {
          raw += chunk;
        });
        request.on("end", () => {
          let body: unknown;
          try {
            body = JSON.parse(raw);
          } catch {
            body = undefined;
          }
          handleEvaluate(body, request.socket.remoteAddress ?? "local").then(
            (result) => respond(result.status, result.body),
            () =>
              respond(500, {
                error: "evaluation failed unexpectedly",
                hint: "tap an example — those never touch the network",
              }),
          );
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), evaluateDevApi()],
  server: {
    host: "127.0.0.1",
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
  },
});
