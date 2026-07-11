import { useCallback, useEffect, useState } from "react";
import inventoryFile from "../data/inventory.json";
import type { ViewerMode } from "../auth/AuthShell";
import type { InventoryFile, Item } from "../lib/types";

const guestInventory = inventoryFile as InventoryFile;
const ACTIVE_DOMAINS = new Set(["kitchen", "electronics", "garage", "bathroom"]);

export type ActiveInventoryState =
  | { status: "guest"; items: Item[]; retry: () => void }
  | { status: "loading"; items: null; retry: () => void }
  | { status: "error"; items: null; error: string; hint: string; retry: () => void }
  | { status: "empty"; items: Item[]; retry: () => void }
  | { status: "populated"; items: Item[]; retry: () => void };

type PersonalInventoryState = Exclude<ActiveInventoryState, { status: "guest" }>;

function isItem(value: unknown): value is Item {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Item>;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.domain === "string" &&
    ACTIVE_DOMAINS.has(item.domain) &&
    Array.isArray(item.capabilities) &&
    item.capabilities.every(
      (capability) =>
        capability &&
        typeof capability.name === "string" &&
        (capability.tier === "primary" || capability.tier === "secondary"),
    )
  );
}

export function useActiveInventory(viewerMode: ViewerMode): ActiveInventoryState {
  const [requestVersion, setRequestVersion] = useState(0);
  const retry = useCallback(() => setRequestVersion((version) => version + 1), []);
  const [personalState, setPersonalState] = useState<PersonalInventoryState>({
    status: "loading",
    items: null,
    retry,
  });

  useEffect(() => {
    if (viewerMode !== "signed-in") return;

    const controller = new AbortController();
    setPersonalState({ status: "loading", items: null, retry });

    void (async () => {
      try {
        const response = await fetch("/api/inventory/items", {
          method: "GET",
          credentials: "same-origin",
          headers: { accept: "application/json" },
          signal: controller.signal,
        });

        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          payload = undefined;
        }

        if (controller.signal.aborted) return;

        if (!response.ok) {
          const failure = payload as { error?: string; hint?: string } | undefined;
          setPersonalState({
            status: "error",
            items: null,
            error: failure?.error ?? "your inventory could not be loaded",
            hint:
              failure?.hint ??
              "Try again. Your account will never fall back to the guest inventory.",
            retry,
          });
          return;
        }

        const items = (payload as { items?: unknown } | undefined)?.items;
        if (!Array.isArray(items) || !items.every(isItem)) {
          throw new Error("inventory response was not valid");
        }

        setPersonalState({
          status: items.length === 0 ? "empty" : "populated",
          items,
          retry,
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        setPersonalState({
          status: "error",
          items: null,
          error:
            error instanceof Error
              ? error.message
              : "your inventory could not be loaded",
          hint: "Check your connection and try loading your inventory again.",
          retry,
        });
      }
    })();

    return () => controller.abort();
  }, [requestVersion, retry, viewerMode]);

  if (viewerMode === "guest") {
    return { status: "guest", items: guestInventory.items, retry };
  }
  if (viewerMode === "loading") {
    return { status: "loading", items: null, retry };
  }
  return personalState;
}
