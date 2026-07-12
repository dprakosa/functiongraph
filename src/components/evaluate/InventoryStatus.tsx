import type { ActiveInventoryState } from "../../inventory/useActiveInventory";

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

/**
 * Compact inventory status + the reserved photo action slot. The
 * #photo-action-slot anchor and data attributes are load-bearing (the empty
 * inventory state links to it; the photo feature will mount here).
 */
export function InventoryStatus({
  inventory,
}: {
  inventory: ActiveInventoryState;
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
      <div
        className="shrink-0"
        id="photo-action-slot"
        data-slot="photo-action"
        tabIndex={-1}
      >
        <button
          className="flex items-center gap-1.5 rounded-control border border-hairline bg-wash px-2.5 py-1.5 text-[11px] font-medium text-body"
          type="button"
          disabled
        >
          Add from photo
          <small className="text-[9px] font-semibold tracking-wide text-faint uppercase">
            Coming next
          </small>
        </button>
        <span className="sr-only">
          Photo capture is reserved here and will be enabled by the photo inventory feature.
        </span>
      </div>
    </section>
  );
}
