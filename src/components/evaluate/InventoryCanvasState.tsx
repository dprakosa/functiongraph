import type { ActiveInventoryState } from "../../inventory/useActiveInventory";

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Full-canvas replacement for the graph while a personal inventory is
 * loading, failed, or empty (never substitutes guest data — PDD DM-10).
 */
export function InventoryCanvasState({
  inventory,
}: {
  inventory: ActiveInventoryState;
}) {
  if (inventory.status === "loading") {
    return (
      <div
        className="absolute inset-0 z-[2] grid content-center justify-items-start bg-white/90 p-8 md:p-14"
        role="status"
      >
        <span className="mb-2 text-[10px] font-semibold tracking-widest text-muted uppercase">
          Personal inventory
        </span>
        <h2 className="m-0 max-w-lg text-2xl font-semibold tracking-tight text-ink md:text-3xl">
          Loading your capability map
        </h2>
        <p className="mt-3 max-w-lg text-[13px] leading-relaxed text-body">
          We are checking the items confirmed for this account.
        </p>
        <div className="mt-5 grid w-full max-w-md gap-2" aria-hidden="true">
          <i className="h-2 animate-pulse rounded-full bg-hairline-soft" />
          <i className="h-2 w-3/4 animate-pulse rounded-full bg-hairline-soft" />
          <i className="h-2 w-1/2 animate-pulse rounded-full bg-hairline-soft" />
        </div>
      </div>
    );
  }

  if (inventory.status === "error") {
    return (
      <div
        className="absolute inset-0 z-[2] grid content-center justify-items-start bg-white/90 p-8 md:p-14"
        role="alert"
      >
        <span className="mb-2 text-[10px] font-semibold tracking-widest text-muted uppercase">
          Personal inventory
        </span>
        <h2 className="m-0 max-w-lg text-2xl font-semibold tracking-tight text-ink md:text-3xl">
          Your inventory could not load
        </h2>
        <p className="mt-3 max-w-lg text-[13px] leading-relaxed text-body">
          {titleCase(inventory.error)}. {inventory.hint}
        </p>
        <button
          className="mt-5 rounded-control bg-accent px-4 py-2 text-[13px] font-semibold text-white shadow-xs transition-colors hover:bg-accent-hover active:bg-accent-pressed"
          type="button"
          onClick={inventory.retry}
        >
          Try again
        </button>
      </div>
    );
  }

  if (inventory.status === "empty") {
    return (
      <div className="absolute inset-0 z-[2] grid content-center justify-items-start bg-white/90 p-8 md:p-14">
        <span className="mb-2 text-[10px] font-semibold tracking-widest text-muted uppercase">
          Your account starts empty
        </span>
        <h2 className="m-0 max-w-lg text-2xl font-semibold tracking-tight text-ink md:text-3xl">
          Capture what you own to build this graph
        </h2>
        <p className="mt-3 max-w-lg text-[13px] leading-relaxed text-body">
          Confirmed items will become rooms, objects, and capabilities here. Demo
          ownership is never substituted into your personal account.
        </p>
        <a
          className="mt-5 rounded-control bg-accent px-4 py-2 text-[13px] font-semibold text-white no-underline shadow-xs transition-colors hover:bg-accent-hover active:bg-accent-pressed"
          href="#photo-action-slot"
        >
          Find the photo action
        </a>
      </div>
    );
  }

  return null;
}
