import { useMemo, useState, type FormEvent } from "react";
import { useViewerState } from "../auth/AuthShell";
import {
  deleteInventoryItem,
  updateInventoryItem,
  InventoryMutationError,
} from "../inventory/inventoryMutations";
import {
  useActiveInventory,
  type ActiveInventoryState,
} from "../inventory/useActiveInventory";
import type { Item } from "../lib/types";
import { RouteLink } from "../routing/RouteLink";
import { PhotoInventoryFlow } from "../components/inventory/PhotoInventoryFlow";

const DOMAINS = ["kitchen", "electronics", "garage", "bathroom"] as const;

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function groupByDomain(items: Item[]): Map<string, Item[]> {
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const group = groups.get(item.domain) ?? [];
    group.push(item);
    groups.set(item.domain, group);
  }
  return new Map(
    [...groups.entries()].sort((a, b) => b[1].length - a[1].length),
  );
}

interface MutationStatus {
  error: string;
  hint: string;
}

function ItemRow({
  item,
  editable,
  onChanged,
}: {
  item: Item;
  editable: boolean;
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "confirm-delete">("view");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<MutationStatus | null>(null);
  const [name, setName] = useState(item.name);
  const [domain, setDomain] = useState(item.domain);
  const [quantity, setQuantity] = useState(
    item.quantity != null ? String(item.quantity) : "",
  );

  const startEdit = () => {
    setName(item.name);
    setDomain(item.domain);
    setQuantity(item.quantity != null ? String(item.quantity) : "");
    setFailure(null);
    setMode("edit");
  };

  const submitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setFailure(null);
    try {
      await updateInventoryItem(item.id, {
        name: name.trim(),
        domain,
        quantity: quantity.trim() === "" ? null : Number(quantity),
      });
      setMode("view");
      onChanged();
    } catch (error) {
      setFailure(
        error instanceof InventoryMutationError
          ? { error: error.message, hint: error.hint }
          : { error: "the inventory change failed", hint: "Try again in a moment." },
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    setBusy(true);
    setFailure(null);
    try {
      await deleteInventoryItem(item.id);
      onChanged();
    } catch (error) {
      setFailure(
        error instanceof InventoryMutationError
          ? { error: error.message, hint: error.hint }
          : { error: "the item couldn't be deleted", hint: "Try again in a moment." },
      );
      setBusy(false);
    }
  };

  return (
    <li className="grid gap-2 border-b border-hairline-soft px-4 py-3 last:border-b-0">
      {mode === "edit" ? (
        <form className="grid gap-2" onSubmit={submitEdit}>
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid min-w-40 flex-1 gap-1 text-[11px] font-medium text-muted">
              Name
              <input
                required
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="rounded-control border border-hairline bg-white px-2.5 py-1.5 text-[13px] text-ink focus:border-accent focus:outline-none"
              />
            </label>
            <label className="grid gap-1 text-[11px] font-medium text-muted">
              Room
              <select
                value={domain}
                onChange={(event) => setDomain(event.target.value)}
                className="rounded-control border border-hairline bg-white px-2 py-1.5 text-[13px] text-ink focus:border-accent focus:outline-none"
              >
                {DOMAINS.map((option) => (
                  <option key={option} value={option}>
                    {titleCase(option)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid w-20 gap-1 text-[11px] font-medium text-muted">
              Quantity
              <input
                type="number"
                min={1}
                step={1}
                value={quantity}
                placeholder="—"
                onChange={(event) => setQuantity(event.target.value)}
                className="rounded-control border border-hairline bg-white px-2.5 py-1.5 text-[13px] text-ink focus:border-accent focus:outline-none"
              />
            </label>
            <div className="flex gap-1.5">
              <button
                type="submit"
                disabled={busy}
                className="rounded-control bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
              >
                {busy ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setMode("view")}
                className="rounded-control border border-hairline bg-white px-3 py-1.5 text-xs font-medium text-body transition-colors hover:bg-hairline-soft"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="text-sm font-semibold text-ink">{item.name}</span>
            {item.quantity != null && item.quantity > 1 && (
              <span className="text-metric text-xs text-muted">×{item.quantity}</span>
            )}
            <span className="flex flex-wrap gap-1">
              {item.capabilities.map((capability) => (
                <span
                  key={`${capability.name}:${capability.tier}`}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] ${
                    capability.tier === "primary"
                      ? "bg-hairline-soft font-medium text-body"
                      : "border border-hairline-soft text-muted"
                  }`}
                >
                  {capability.name}
                </span>
              ))}
            </span>
          </div>
          {editable && (
            <div className="flex shrink-0 gap-1.5">
              {mode === "confirm-delete" ? (
                <>
                  <span className="self-center text-xs text-body">
                    Delete “{item.name}”?
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={confirmDelete}
                    className="rounded-control bg-ink px-2.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {busy ? "Deleting…" : "Delete"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setMode("view")}
                    className="rounded-control border border-hairline bg-white px-2.5 py-1.5 text-xs font-medium text-body transition-colors hover:bg-hairline-soft"
                  >
                    Keep
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={startEdit}
                    className="rounded-control border border-hairline bg-white px-2.5 py-1.5 text-xs font-medium text-body transition-colors hover:bg-hairline-soft"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("confirm-delete")}
                    className="rounded-control border border-hairline bg-white px-2.5 py-1.5 text-xs font-medium text-body transition-colors hover:bg-hairline-soft"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
      {failure && (
        <p className="m-0 text-xs text-body" role="alert">
          <strong className="font-semibold text-ink">{titleCase(failure.error)}.</strong>{" "}
          {failure.hint}
        </p>
      )}
    </li>
  );
}

function InventoryBody({
  inventory,
  editable,
}: {
  inventory: ActiveInventoryState;
  editable: boolean;
}) {
  const items = inventory.items ?? [];
  const groups = useMemo(() => groupByDomain(items), [items]);

  if (inventory.status === "loading") {
    return (
      <div className="mt-8 grid gap-2" role="status" aria-label="Loading inventory">
        <span className="sr-only">Loading your confirmed items</span>
        <i className="h-16 animate-pulse rounded-card bg-hairline-soft" />
        <i className="h-16 animate-pulse rounded-card bg-hairline-soft" />
        <i className="h-16 w-3/4 animate-pulse rounded-card bg-hairline-soft" />
      </div>
    );
  }

  if (inventory.status === "error") {
    return (
      <div
        className="mt-8 grid justify-items-start gap-3 rounded-panel border border-hairline bg-wash px-6 py-10"
        role="alert"
      >
        <h2 className="m-0 text-base font-semibold text-ink">
          Your inventory could not load
        </h2>
        <p className="m-0 text-[13px] text-body">
          {titleCase(inventory.error)}. {inventory.hint}
        </p>
        <button
          type="button"
          onClick={inventory.retry}
          className="rounded-control bg-accent px-4 py-2 text-[13px] font-semibold text-white shadow-xs transition-colors hover:bg-accent-hover"
        >
          Try again
        </button>
      </div>
    );
  }

  if (inventory.status === "empty") {
    return (
      <div className="mt-8 grid justify-items-center gap-3 rounded-panel border border-dashed border-hairline bg-wash px-6 py-14 text-center">
        <h2 className="m-0 text-base font-semibold text-ink">
          Your account starts empty
        </h2>
        <p className="m-0 max-w-sm text-[13px] leading-relaxed text-muted">
          Use Add from photo to scan what you own. Confirmed items appear here
          and become part of every product comparison.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-6">
      {[...groups.entries()].map(([domain, domainItems]) => (
        <section key={domain} aria-labelledby={`room-${domain}`}>
          <div className="flex items-baseline gap-2">
            <h2
              id={`room-${domain}`}
              className="m-0 text-sm font-semibold tracking-tight text-ink"
            >
              {titleCase(domain)}
            </h2>
            <span className="text-metric text-xs text-faint">
              {domainItems.length} {domainItems.length === 1 ? "item" : "items"}
            </span>
          </div>
          <ul className="m-0 mt-2 grid list-none rounded-panel border border-hairline bg-white p-0 shadow-xs">
            {domainItems.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                editable={editable}
                onChanged={inventory.retry}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function InventoryPage() {
  const viewer = useViewerState();
  const inventory = useActiveInventory(viewer.mode, viewer.identityKey);
  const itemCount = inventory.items?.length ?? 0;

  return (
    <main
      className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-10"
      aria-labelledby="inventory-title"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1
            id="inventory-title"
            data-route-heading
            tabIndex={-1}
            className="m-0 text-2xl font-semibold tracking-tight text-ink outline-none"
          >
            Your inventory
          </h1>
          <p className="m-0 text-[13px] text-muted">
            {inventory.status === "guest"
              ? `${itemCount} everyday items across a starter household`
              : inventory.status === "populated"
                ? `${itemCount} confirmed ${itemCount === 1 ? "item" : "items"}`
                : "The objects your evaluations are scored against"}
          </p>
        </div>
        <PhotoInventoryFlow
          inventory={inventory}
          identityKey={viewer.identityKey}
        />
      </header>

      {inventory.status === "guest" && (
        <aside className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-accent/20 bg-accent-soft/60 px-4 py-3">
          <p className="m-0 text-[13px] text-body">
            <strong className="font-semibold text-ink">Starter household.</strong>{" "}
            Browse these common items to see how Subgraph works, then sign in to
            use the items in your own home.
          </p>
          <RouteLink
            to="/settings"
            className="shrink-0 text-[13px] font-semibold text-accent no-underline hover:underline"
          >
            Go to account →
          </RouteLink>
        </aside>
      )}

      <InventoryBody
        inventory={inventory}
        editable={inventory.status === "populated"}
      />
    </main>
  );
}
