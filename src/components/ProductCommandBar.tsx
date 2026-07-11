import type { FormEventHandler } from "react";
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
 * The single product-entry surface (INT-3). Demo labels are read directly from
 * the cache so their normalized keys cannot drift away from the offline path.
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
  return (
    <form className="product-form" onSubmit={onSubmit} aria-busy={isEvaluating}>
      <label htmlFor="product-text">What are you considering?</label>
      <div className="product-form__input">
        <textarea
          id="product-text"
          name="text"
          rows={2}
          minLength={3}
          maxLength={1500}
          required
          value={draft}
          disabled={unavailable}
          placeholder="Paste a product name, listing, or short description"
          onChange={(event) => onDraftChange(event.target.value)}
        />
        <button
          className="button button--evaluate"
          type="submit"
          disabled={unavailable}
        >
          <span>
            {disabled ? disabledLabel : isEvaluating ? "Evaluating" : "Map capabilities"}
          </span>
          <span aria-hidden="true">→</span>
        </button>
      </div>

      <div className="try-these" aria-label="Try these examples">
        <span>Try these</span>
        <div>
          {TRY_THESE_CHIPS.map((chip) => (
            <button
              type="button"
              key={chip}
              disabled={unavailable}
              onClick={() => onExample(chip)}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}
