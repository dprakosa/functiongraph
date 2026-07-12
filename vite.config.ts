import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vitest/config";
import { handleEvaluate } from "./api/_lib/handler";
import inventoryFile from "./src/data/inventory.json";
import type { InventoryFile } from "./src/lib/types";

const guestInventory = inventoryFile as InventoryFile;

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
          handleEvaluate(
            body,
            request.socket.remoteAddress ?? "local",
            guestInventory.items,
          ).then(
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

/**
 * Vite's SPA fallback would otherwise serve index.html for unknown /api paths.
 * Keep browser-route fallback behavior without turning API failures into HTML.
 */
function unknownApiGuard(): Plugin {
  return {
    name: "unknown-api-guard",
    configureServer(server) {
      server.middlewares.use("/api", (_request, response) => {
        response.statusCode = 404;
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            error: "API route not found",
            hint: "Check the request path and method.",
          }),
        );
      });
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), react(), evaluateDevApi(), unknownApiGuard()],
  server: {
    host: "127.0.0.1",
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
  },
});
