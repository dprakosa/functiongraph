import { useEffect, useRef, type FormEventHandler } from "react";
import { TRY_THESE_CHIPS } from "../state/evaluateClient";

interface ProductCommandBarProps {
  draft: string;
  isEvaluating: boolean;
  disabled?: boolean;
  disabledLabel?: string;
  onDraftChange: (value: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onExample: (chip: string) => void;
}

/**
 * The single product-entry surface (INT-3), styled as a command bar.
 * ⌘K / Ctrl+K focuses it from anywhere on the page. Demo labels are read
 * directly from the cache so their normalized keys cannot drift away from
 * the offline path.
 */
export function ProductCommandBar({
  draft,
  isEvaluating,
  disabled = false,
  disabledLabel = "Inventory unavailable",
  onDraftChange,
  onSubmit,
  onExample,
}: ProductCommandBarProps) {
  const unavailable = disabled || isEvaluating;
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <form className="grid gap-2" onSubmit={onSubmit} aria-busy={isEvaluating}>
      <label htmlFor="product-text" className="sr-only">
        What are you considering?
      </label>
      <div className="relative flex items-start gap-2 rounded-card border border-hairline bg-white p-1.5 shadow-xs transition-shadow focus-within:border-accent focus-within:shadow-[0_0_0_1px_var(--color-accent)]">
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className="mt-2.5 ml-2 h-4 w-4 shrink-0 text-faint"
        >
          <circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="m10.6 10.6 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <textarea
          ref={inputRef}
          id="product-text"
          name="text"
          rows={1}
          minLength={3}
          maxLength={1500}
          required
          value={draft}
          disabled={unavailable}
          placeholder="Paste a product name, listing, or short description"
          onChange={(event) => onDraftChange(event.target.value)}
          className="min-h-9 flex-1 resize-none self-center border-0 bg-transparent py-2 text-sm text-ink outline-none placeholder:text-faint disabled:opacity-60"
        />
        <kbd
          aria-hidden="true"
          className="mt-2 hidden shrink-0 rounded-chip border border-hairline bg-wash px-1.5 py-0.5 text-[10px] font-medium text-faint md:block"
        >
          ⌘K
        </kbd>
        <button
          className="shrink-0 self-center rounded-control bg-accent px-3 py-2 text-xs font-semibold whitespace-nowrap text-white shadow-xs transition-colors hover:bg-accent-hover active:bg-accent-pressed disabled:pointer-events-none"
          type="submit"
          disabled={unavailable}
        >
          {disabled ? disabledLabel : isEvaluating ? "Evaluating…" : "Map capabilities"}
        </button>
      </div>

      <div
        className="flex flex-wrap items-center gap-1.5"
        aria-label="Try these examples"
      >
        <span className="text-[11px] font-semibold text-muted">Try these</span>
        {TRY_THESE_CHIPS.map((chip) => (
          <button
            type="button"
            key={chip}
            disabled={unavailable}
            onClick={() => onExample(chip)}
            className="rounded-full bg-hairline-soft px-2.5 py-1 text-[11px] whitespace-nowrap text-body transition-colors hover:bg-hairline hover:text-ink disabled:opacity-50"
          >
            {chip}
          </button>
        ))}
      </div>
    </form>
  );
}
