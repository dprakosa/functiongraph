import type { Item } from "../../lib/types";

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Contextual rail content for a selected owned item.
 */
export function ItemInspector({
  item,
  onClose,
}: {
  item: Item;
  onClose: () => void;
}) {
  return (
    <aside
      className="flex h-full min-h-0 flex-col overflow-y-auto bg-white p-4 motion-safe:animate-panel-in"
      data-slot="item-inspector"
      aria-labelledby="item-inspector-title"
    >
      <div className="flex items-start justify-between gap-3 border-b border-hairline pb-3">
        <div>
          <p className="m-0 text-[11px] font-semibold tracking-wide text-muted uppercase">
            Item inspector
          </p>
          <h2
            id="item-inspector-title"
            className="m-0 mt-0.5 text-base font-semibold tracking-tight text-ink"
          >
            {item.name}
          </h2>
        </div>
        <button
          type="button"
          aria-label="Close item inspector"
          onClick={onClose}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-control text-base text-muted transition-colors hover:bg-hairline-soft hover:text-ink"
        >
          ×
        </button>
      </div>
      <p className="m-0 mt-3 inline-flex w-fit rounded-chip bg-hairline-soft px-2 py-0.5 text-[11px] font-medium text-body">
        {titleCase(item.domain)}
      </p>
      <h3 className="m-0 mt-4 text-[13px] font-semibold text-ink">
        Mapped capabilities
      </h3>
      <ul className="m-0 mt-2 grid list-none gap-1 p-0">
        {item.capabilities.map((capability) => (
          <li
            key={`${capability.name}:${capability.tier}`}
            className="flex items-center justify-between gap-2 rounded-control border border-hairline bg-wash px-2.5 py-1.5"
          >
            <span className="min-w-0 truncate text-[13px] text-ink">
              {capability.name}
            </span>
            <small className="shrink-0 rounded-chip bg-hairline-soft px-1.5 py-0.5 text-[10px] font-medium text-muted">
              {capability.tier}
            </small>
          </li>
        ))}
      </ul>
      <p className="m-0 mt-4 text-[11px] leading-relaxed text-muted">
        Edit and delete controls will use this contextual rail in the saved-item release.
      </p>
    </aside>
  );
}
