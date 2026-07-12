import type { ActiveInventoryState } from "../../inventory/useActiveInventory";
import { PhotoInventoryFlow } from "../inventory/PhotoInventoryFlow";

export function inventoryStatusCopy(inventory: ActiveInventoryState): {
  label: string;
  detail: string;
} {
  switch (inventory.status) {
    case "guest":
      return {
        label: "Guest inventory",
        detail: `${inventory.items.length} bundled items · examples stay offline`,
      };
    case "loading":
      return { label: "Personal inventory", detail: "Loading your confirmed items" };
    case "error":
      return { label: "Personal inventory", detail: "Inventory unavailable" };
    case "empty":
      return { label: "Personal inventory", detail: "No confirmed items yet" };
    case "populated":
      return {
        label: "Personal inventory",
        detail: `${inventory.items.length} confirmed ${inventory.items.length === 1 ? "item" : "items"}`,
      };
  }
}

/** Compact inventory status + the live photo-inventory entry point. */
export function InventoryStatus({
  inventory,
  identityKey,
}: {
  inventory: ActiveInventoryState;
  identityKey?: string | null;
}) {
  const status = inventoryStatusCopy(inventory);
  return (
    <section
      className="flex items-center justify-between gap-3"
      aria-label="Inventory status and photo action"
    >
      <div
        className="flex min-w-0 items-center gap-2"
        role="status"
        aria-live="polite"
        data-inventory-status={inventory.status}
      >
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            inventory.status === "loading"
              ? "animate-pulse bg-faint"
              : inventory.status === "error"
                ? "border border-faint bg-transparent"
                : "bg-new"
          }`}
        />
        <span className="flex min-w-0 items-baseline gap-1.5">
          <strong className="shrink-0 text-[11px] font-semibold text-ink">
            {status.label}
          </strong>
          <small className="truncate text-[11px] text-muted">{status.detail}</small>
        </span>
      </div>
      <PhotoInventoryFlow
        inventory={inventory}
        identityKey={identityKey}
        compact
        id="photo-action-slot"
      />
    </section>
  );
}
