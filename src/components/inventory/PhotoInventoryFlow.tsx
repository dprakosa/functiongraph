import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  confirmInventoryItems,
  InventoryMutationError,
  scanInventoryPhoto,
} from "../../inventory/inventoryMutations";
import type { ActiveInventoryState } from "../../inventory/useActiveInventory";
import type {
  ConfirmedInventoryItemInput,
  InventoryDomain,
  InventoryScanCandidate,
} from "../../lib/types";
import { RouteLink } from "../../routing/RouteLink";

const DOMAINS: InventoryDomain[] = [
  "kitchen",
  "electronics",
  "garage",
  "bathroom",
];
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_IMAGE_BYTES = 2.5 * 1024 * 1024;
const MAX_QUANTITY = 2_147_483_647;

type FlowStep =
  | "idle"
  | "preparing"
  | "scanning"
  | "review"
  | "saving"
  | "success"
  | "empty-result"
  | "error"
  | "rate-limit"
  | "cancelled";

interface FlowFailure {
  error: string;
  hint: string;
}

interface ReviewItem {
  candidate: InventoryScanCandidate;
  selected: boolean;
  name: string;
  domain: InventoryDomain | "";
  quantity: string;
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function hasValidQuantity(value: string): boolean {
  if (value.trim() === "") return true;
  const quantity = Number(value);
  return (
    Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= MAX_QUANTITY
  );
}

function toConfirmedItem(item: ReviewItem): ConfirmedInventoryItemInput {
  return {
    name: item.name.trim(),
    domain: item.domain as InventoryDomain,
    quantity: item.quantity.trim() === "" ? null : Number(item.quantity),
    capabilities: item.candidate.capabilities.map((capability) => ({
      name: capability.name,
      tier: capability.tier,
    })),
  };
}

function readAsDataUrl(file: File, reader: FileReader): Promise<string> {
  return new Promise((resolve, reject) => {
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("the selected photo could not be read"));
    });
    reader.addEventListener("error", () => {
      reject(new Error("the selected photo could not be read"));
    });
    reader.addEventListener("abort", () => {
      reject(new DOMException("Photo reading was cancelled", "AbortError"));
    });
    reader.readAsDataURL(file);
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function PhotoInventoryFlow({
  inventory,
  identityKey,
  compact = false,
  id,
}: {
  inventory: ActiveInventoryState;
  identityKey?: string | null;
  compact?: boolean;
  id?: string;
}) {
  const generatedId = useId();
  const titleId = `${generatedId}-title`;
  const descriptionId = `${generatedId}-description`;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<FlowStep>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [roomHint, setRoomHint] = useState("");
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [failure, setFailure] = useState<FlowFailure | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [lastStatus, setLastStatus] = useState("");
  const [ambiguousSave, setAmbiguousSave] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readerRef = useRef<FileReader | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const confirmationInFlightRef = useRef(false);
  const operationRef = useRef(0);
  const mountedRef = useRef(true);
  const identityRef = useRef(identityKey);

  const unavailable =
    inventory.status === "loading" || inventory.status === "error";
  const isGuest = inventory.status === "guest";
  const identityIsCurrent = identityRef.current === identityKey;

  const releaseRawPhoto = (abort = true) => {
    if (abort) {
      operationRef.current += 1;
      if (readerRef.current?.readyState === FileReader.LOADING) {
        readerRef.current.abort();
      }
      requestRef.current?.abort();
    }
    readerRef.current = null;
    requestRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = "";
    setFile(null);
  };

  const discardDraft = () => {
    setReviewItems([]);
    setWarnings([]);
    setRoomHint("");
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      operationRef.current += 1;
      if (readerRef.current?.readyState === FileReader.LOADING) {
        readerRef.current.abort();
      }
      requestRef.current?.abort();
      readerRef.current = null;
      requestRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
  }, []);

  useEffect(() => {
    if (identityRef.current === identityKey) return;
    identityRef.current = identityKey;
    releaseRawPhoto();
    discardDraft();
    confirmationInFlightRef.current = false;
    setFailure(null);
    setAmbiguousSave(false);
    setSavedCount(0);
    setStep("cancelled");
    setLastStatus("Photo scan cleared because the active account changed.");
    setOpen(false);
  }, [identityKey]);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus({ preventScroll: true });
  }, [open, step]);

  const selectedItems = useMemo(
    () => reviewItems.filter((item) => item.selected),
    [reviewItems],
  );
  const selectedItemsAreValid = selectedItems.every(
    (item) =>
      item.name.trim().length > 0 &&
      item.name.trim().length <= 100 &&
      item.domain !== "" &&
      hasValidQuantity(item.quantity),
  );
  const canConfirm =
    identityIsCurrent &&
    !unavailable &&
    step === "review" &&
    selectedItems.length > 0 &&
    selectedItemsAreValid;

  const openFlow = () => {
    if (unavailable) return;
    releaseRawPhoto();
    discardDraft();
    setFailure(null);
    setAmbiguousSave(false);
    setSavedCount(0);
    setLastStatus("");
    confirmationInFlightRef.current = false;
    setStep("idle");
    setOpen(true);
  };

  const closeFlow = (cancelled: boolean) => {
    releaseRawPhoto();
    discardDraft();
    setFailure(null);
    setAmbiguousSave(false);
    setSavedCount(0);
    confirmationInFlightRef.current = false;
    setStep(cancelled ? "cancelled" : "idle");
    setLastStatus(cancelled ? "Photo scan cancelled." : "");
    setOpen(false);
    window.setTimeout(() => {
      if (triggerRef.current && !triggerRef.current.disabled) {
        triggerRef.current.focus();
      } else {
        wrapperRef.current?.focus();
      }
    }, 0);
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (step !== "saving") closeFlow(step !== "success");
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = [
      ...dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ];
    if (focusable.length === 0) {
      event.preventDefault();
      dialogRef.current.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const activeElement = document.activeElement;
    if (
      activeElement === dialogRef.current ||
      !dialogRef.current.contains(activeElement)
    ) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return;
    }
    if (event.shiftKey && activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setFailure(null);
    if (!nextFile) {
      setFile(null);
      return;
    }
    if (!SUPPORTED_IMAGE_TYPES.has(nextFile.type)) {
      releaseRawPhoto(false);
      setFailure({
        error: "That photo format is not supported",
        hint: "Choose a JPEG, PNG, or WebP photo. HEIC is not supported yet.",
      });
      setStep("error");
      return;
    }
    if (nextFile.size > MAX_IMAGE_BYTES) {
      releaseRawPhoto(false);
      setFailure({
        error: "That photo is too large",
        hint: "Choose a photo smaller than 2.5 MiB, then try again.",
      });
      setStep("error");
      return;
    }
    setFile(nextFile);
    setStep("idle");
  };

  const startScan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || step !== "idle" || !identityIsCurrent || unavailable) return;

    const selectedFile = file;
    const operation = operationRef.current + 1;
    operationRef.current = operation;
    setFailure(null);
    setStep("preparing");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    try {
      const reader = new FileReader();
      readerRef.current = reader;
      const imageDataUrl = await readAsDataUrl(selectedFile, reader);
      readerRef.current = null;
      if (!mountedRef.current || operationRef.current !== operation) return;

      const controller = new AbortController();
      requestRef.current = controller;
      setStep("scanning");
      const result = await scanInventoryPhoto(
        imageDataUrl,
        roomHint.trim() || undefined,
        controller.signal,
      );
      requestRef.current = null;
      if (!mountedRef.current || operationRef.current !== operation) return;

      setRoomHint("");
      setWarnings(result.warnings);
      if (result.items.length === 0) {
        setReviewItems([]);
        setStep("empty-result");
        return;
      }
      setReviewItems(
        result.items.map((candidate) => ({
          candidate,
          selected: false,
          name: candidate.name,
          domain: DOMAINS.includes(candidate.suggestedDomain as InventoryDomain)
            ? (candidate.suggestedDomain as InventoryDomain)
            : "",
          quantity: candidate.quantity == null ? "" : String(candidate.quantity),
        })),
      );
      setStep("review");
    } catch (error) {
      readerRef.current = null;
      requestRef.current = null;
      if (
        !mountedRef.current ||
        operationRef.current !== operation ||
        isAbortError(error)
      ) {
        return;
      }
      setRoomHint("");
      setFailure(
        error instanceof InventoryMutationError
          ? { error: error.message, hint: error.hint }
          : {
              error:
                error instanceof Error
                  ? error.message
                  : "the photo scan could not be completed",
              hint: "Check your connection and choose the photo again.",
            },
      );
      setStep(
        error instanceof InventoryMutationError && error.status === 429
          ? "rate-limit"
          : "error",
      );
    }
  };

  const updateReviewItem = (
    index: number,
    patch: Partial<Pick<ReviewItem, "selected" | "name" | "domain" | "quantity">>,
  ) => {
    setReviewItems((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  };

  const confirmReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      !canConfirm ||
      !identityIsCurrent ||
      unavailable ||
      confirmationInFlightRef.current
    ) {
      return;
    }

    const confirmed = selectedItems.map(toConfirmedItem);
    confirmationInFlightRef.current = true;
    const operation = operationRef.current + 1;
    operationRef.current = operation;
    const controller = new AbortController();
    requestRef.current = controller;
    setFailure(null);
    setAmbiguousSave(false);
    setStep("saving");

    try {
      await confirmInventoryItems(confirmed, controller.signal);
      requestRef.current = null;
      if (!mountedRef.current || operationRef.current !== operation) return;
      const count = confirmed.length;
      discardDraft();
      setSavedCount(count);
      setStep("success");
      setLastStatus(
        `${count} ${count === 1 ? "item" : "items"} added to your inventory.`,
      );
      inventory.retry();
    } catch (error) {
      requestRef.current = null;
      if (
        !mountedRef.current ||
        operationRef.current !== operation ||
        isAbortError(error)
      ) {
        return;
      }
      // A failed or ambiguous confirmation is never retried automatically: the
      // server has no idempotency key, so replaying it could create duplicates.
      const mayHaveCompleted =
        !(error instanceof InventoryMutationError) || error.status === null;
      discardDraft();
      setAmbiguousSave(mayHaveCompleted);
      setFailure(
        error instanceof InventoryMutationError
          ? { error: error.message, hint: error.hint }
          : {
              error: "the reviewed items could not be saved",
              hint:
                "Refresh your inventory before scanning again in case the save completed.",
            },
      );
      if (mayHaveCompleted) inventory.retry();
      setStep("error");
      confirmationInFlightRef.current = false;
    }
  };

  const startOver = () => {
    releaseRawPhoto();
    discardDraft();
    setFailure(null);
    setAmbiguousSave(false);
    setSavedCount(0);
    confirmationInFlightRef.current = false;
    setStep("idle");
  };

  const triggerClass = compact
    ? "flex items-center gap-1.5 rounded-control border border-hairline bg-white px-2.5 py-1.5 text-[11px] font-medium text-body shadow-xs transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:bg-wash disabled:text-faint disabled:shadow-none"
    : "flex items-center gap-1.5 rounded-control border border-hairline bg-white px-3 py-2 text-xs font-medium text-body shadow-xs transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:bg-wash disabled:text-faint disabled:shadow-none";

  return (
    <div
      ref={wrapperRef}
      className="shrink-0"
      id={id}
      data-slot="photo-action"
      tabIndex={-1}
    >
      <button
        ref={triggerRef}
        className={triggerClass}
        type="button"
        disabled={unavailable}
        onClick={openFlow}
        aria-haspopup="dialog"
      >
        Add from photo
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {lastStatus}
      </span>

      {open && identityIsCurrent && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/30 p-3 backdrop-blur-[2px] md:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && step !== "saving") {
              closeFlow(step !== "success");
            }
          }}
        >
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            tabIndex={-1}
            onKeyDown={handleDialogKeyDown}
            className="grid max-h-[calc(100vh-1.5rem)] w-full max-w-3xl overflow-hidden rounded-panel border border-hairline bg-white shadow-overlay outline-none md:max-h-[calc(100vh-3rem)]"
          >
            <header className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4 md:px-6">
              <div className="grid gap-1">
                <h2
                  id={titleId}
                  className="m-0 text-lg font-semibold tracking-tight text-ink"
                >
                  {isGuest ? "Sign in to add your inventory" : "Add from photo"}
                </h2>
                <p
                  id={descriptionId}
                  className="m-0 max-w-2xl text-xs leading-relaxed text-muted"
                >
                  {isGuest
                    ? "Photos can only be scanned into an account you control."
                    : "The photo and scan details are temporary. Only items you review and confirm are saved."}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close photo inventory"
                disabled={step === "saving"}
                onClick={() => closeFlow(step !== "success")}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-control text-lg text-muted transition-colors hover:bg-hairline-soft hover:text-ink disabled:cursor-wait disabled:opacity-40"
              >
                ×
              </button>
            </header>

            <div className="min-h-0 overflow-y-auto px-5 py-5 md:px-6 md:py-6">
              {isGuest ? (
                <div className="grid justify-items-start gap-4">
                  <div className="rounded-card border border-accent/20 bg-accent-soft px-4 py-3 text-[13px] leading-relaxed text-body">
                    The guest graph remains an offline demo. Sign in or create an
                    account before choosing a photo, so confirmed items stay
                    private to you.
                  </div>
                  <RouteLink
                    to="/settings"
                    onClick={() => closeFlow(false)}
                    className="rounded-control bg-accent px-4 py-2 text-[13px] font-semibold text-white no-underline shadow-xs transition-colors hover:bg-accent-hover"
                  >
                    Go to sign in
                  </RouteLink>
                </div>
              ) : (
                <>
                  {(step === "idle" || step === "cancelled") && (
                    <form className="grid gap-5" onSubmit={startScan}>
                      <div className="grid gap-2">
                        <span className="text-[11px] font-semibold text-ink">
                          Household photo
                        </span>
                        <label className="grid min-h-28 cursor-pointer place-items-center gap-2 rounded-card border border-dashed border-hairline bg-wash px-5 py-6 text-center transition-colors hover:border-accent/60 hover:bg-accent-soft/40">
                          <span className="text-sm font-semibold text-ink">
                            {file ? file.name : "Choose or take a photo"}
                          </span>
                          <span className="text-xs text-muted">
                            JPEG, PNG, or WebP · up to 2.5 MiB
                          </span>
                          <input
                            ref={fileInputRef}
                            className="sr-only"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            capture="environment"
                            onChange={chooseFile}
                          />
                        </label>
                      </div>
                      <label className="grid gap-1.5 text-[11px] font-semibold text-ink">
                        Room hint <span className="font-normal text-faint">Optional</span>
                        <input
                          value={roomHint}
                          maxLength={80}
                          onChange={(event) => setRoomHint(event.target.value)}
                          placeholder="e.g. kitchen counter"
                          className="rounded-control border border-hairline bg-white px-3 py-2 text-[13px] font-normal text-ink placeholder:text-faint focus:border-accent focus:outline-none"
                        />
                      </label>
                      <div className="flex flex-wrap justify-end gap-2 border-t border-hairline pt-4">
                        <button
                          type="button"
                          onClick={() => closeFlow(true)}
                          className="rounded-control border border-hairline bg-white px-4 py-2 text-[13px] font-medium text-body hover:bg-wash"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={!file}
                          className="rounded-control bg-accent px-4 py-2 text-[13px] font-semibold text-white shadow-xs transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Scan photo
                        </button>
                      </div>
                    </form>
                  )}

                  {(step === "preparing" || step === "scanning") && (
                    <div
                      className="grid justify-items-center gap-3 py-12 text-center"
                      role="status"
                      aria-live="polite"
                    >
                      <i className="h-8 w-8 animate-spin rounded-full border-2 border-hairline border-t-accent motion-reduce:animate-none" />
                      <h3 className="m-0 text-base font-semibold text-ink">
                        {step === "preparing"
                          ? "Preparing your photo"
                          : "Finding household items"}
                      </h3>
                      <p className="m-0 max-w-sm text-xs leading-relaxed text-muted">
                        {step === "preparing"
                          ? "Reading the image locally before its temporary scan."
                          : "This can take a moment. Nothing is saved until you review it."}
                      </p>
                      <button
                        type="button"
                        onClick={() => closeFlow(true)}
                        className="mt-2 rounded-control border border-hairline bg-white px-3 py-1.5 text-xs font-medium text-body hover:bg-wash"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {(step === "review" || step === "saving") && (
                    <form className="grid gap-4" onSubmit={confirmReview}>
                      <div className="flex flex-wrap items-end justify-between gap-2">
                        <div>
                          <h3 className="m-0 text-base font-semibold text-ink">
                            Review detected items
                          </h3>
                          <p className="m-0 mt-1 text-xs text-muted">
                            Select what is yours and correct the editable fields.
                          </p>
                        </div>
                        <span className="text-metric text-xs font-medium text-body">
                          {selectedItems.length} of {reviewItems.length} selected
                        </span>
                      </div>

                      {warnings.length > 0 && (
                        <aside className="rounded-card border border-hairline bg-wash px-4 py-3 text-xs leading-relaxed text-body">
                          <strong className="font-semibold text-ink">Scan notes</strong>
                          <ul className="m-0 mt-1 grid gap-1 pl-4">
                            {warnings.map((warning, index) => (
                              <li key={`${warning}:${index}`}>{warning}</li>
                            ))}
                          </ul>
                        </aside>
                      )}

                      <ul className="m-0 grid list-none gap-3 p-0">
                        {reviewItems.map((item, index) => {
                          const quantityIsValid = hasValidQuantity(item.quantity);
                          return (
                            <li
                              key={item.candidate.id}
                              className={`grid gap-3 rounded-card border p-4 ${
                                item.selected
                                  ? "border-accent/30 bg-white"
                                  : "border-hairline bg-wash opacity-70"
                              }`}
                            >
                              <label className="flex cursor-pointer items-start gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={item.selected}
                                  disabled={step === "saving"}
                                  onChange={(event) =>
                                    updateReviewItem(index, {
                                      selected: event.target.checked,
                                    })
                                  }
                                  className="mt-0.5 h-4 w-4 accent-accent"
                                />
                                <span className="grid gap-0.5">
                                  <strong className="text-sm font-semibold text-ink">
                                    {item.candidate.name}
                                  </strong>
                                  <small className="text-[11px] leading-relaxed text-muted">
                                    {titleCase(item.candidate.confidence)} review priority · {item.candidate.evidence}
                                  </small>
                                </span>
                              </label>

                              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_110px]">
                                <label className="grid gap-1 text-[10px] font-semibold text-muted">
                                  Name
                                  <input
                                    value={item.name}
                                    maxLength={100}
                                    required={item.selected}
                                    disabled={!item.selected || step === "saving"}
                                    onChange={(event) =>
                                      updateReviewItem(index, { name: event.target.value })
                                    }
                                    className="rounded-control border border-hairline bg-white px-2.5 py-2 text-[13px] font-normal text-ink focus:border-accent focus:outline-none disabled:bg-wash"
                                  />
                                </label>
                                <label className="grid gap-1 text-[10px] font-semibold text-muted">
                                  Room
                                  <select
                                    value={item.domain}
                                    required={item.selected}
                                    disabled={!item.selected || step === "saving"}
                                    onChange={(event) =>
                                      updateReviewItem(index, {
                                        domain: event.target.value as InventoryDomain | "",
                                      })
                                    }
                                    className="rounded-control border border-hairline bg-white px-2.5 py-2 text-[13px] font-normal text-ink focus:border-accent focus:outline-none disabled:bg-wash"
                                  >
                                    <option value="">Choose room</option>
                                    {DOMAINS.map((domain) => (
                                      <option key={domain} value={domain}>
                                        {titleCase(domain)}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="grid gap-1 text-[10px] font-semibold text-muted">
                                  Quantity
                                  <input
                                    type="number"
                                    min={1}
                                    max={MAX_QUANTITY}
                                    step={1}
                                    value={item.quantity}
                                    aria-invalid={item.selected && !quantityIsValid}
                                    disabled={!item.selected || step === "saving"}
                                    placeholder="Optional"
                                    onChange={(event) =>
                                      updateReviewItem(index, {
                                        quantity: event.target.value,
                                      })
                                    }
                                    className="rounded-control border border-hairline bg-white px-2.5 py-2 text-[13px] font-normal text-ink focus:border-accent focus:outline-none disabled:bg-wash"
                                  />
                                </label>
                              </div>

                              <div className="flex flex-wrap gap-1.5" aria-label="Detected capabilities">
                                {item.candidate.capabilities.map((capability) => (
                                  <span
                                    key={`${capability.name}:${capability.tier}`}
                                    className="rounded-full border border-hairline bg-wash px-2 py-1 text-[10.5px] text-body"
                                  >
                                    {capability.name}
                                  </span>
                                ))}
                              </div>
                            </li>
                          );
                        })}
                      </ul>

                      {!canConfirm && step === "review" && (
                        <p className="m-0 text-xs text-body" role="status">
                          {selectedItems.length === 0
                            ? "Select at least one item to continue."
                            : "Give every selected item a name, room, and valid whole-number quantity (or leave quantity blank)."}
                        </p>
                      )}

                      <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap justify-between gap-2 border-t border-hairline bg-white px-5 py-4 md:-mx-6 md:-mb-6 md:px-6">
                        <button
                          type="button"
                          disabled={step === "saving"}
                          onClick={() => closeFlow(true)}
                          className="rounded-control border border-hairline bg-white px-4 py-2 text-[13px] font-medium text-body hover:bg-wash disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={!canConfirm}
                          className="rounded-control bg-accent px-4 py-2 text-[13px] font-semibold text-white shadow-xs transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {step === "saving"
                            ? "Saving…"
                            : `Add ${selectedItems.length || "selected"} ${selectedItems.length === 1 ? "item" : "items"}`}
                        </button>
                      </div>
                    </form>
                  )}

                  {step === "empty-result" && (
                    <div className="grid justify-items-start gap-4 py-4">
                      <div>
                        <h3 className="m-0 text-base font-semibold text-ink">
                          No household items found
                        </h3>
                        <p className="m-0 mt-2 max-w-lg text-xs leading-relaxed text-muted">
                          Try a clearer, well-lit photo with the objects fully in frame.
                        </p>
                      </div>
                      {warnings.length > 0 && (
                        <ul className="m-0 grid gap-1 pl-5 text-xs text-body">
                          {warnings.map((warning, index) => (
                            <li key={`${warning}:${index}`}>{warning}</li>
                          ))}
                        </ul>
                      )}
                      <button
                        type="button"
                        onClick={startOver}
                        className="rounded-control bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent-hover"
                      >
                        Choose another photo
                      </button>
                    </div>
                  )}

                  {(step === "error" || step === "rate-limit") && failure && (
                    <div className="grid justify-items-start gap-4 py-4" role="alert">
                      <div>
                        <h3 className="m-0 text-base font-semibold text-ink">
                          {titleCase(failure.error)}
                        </h3>
                        <p className="m-0 mt-2 max-w-lg text-xs leading-relaxed text-body">
                          {failure.hint}
                        </p>
                        {step === "rate-limit" && (
                          <p className="m-0 mt-2 text-xs text-muted">
                            The scan limit protects the shared service. Wait a minute before trying again.
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {!ambiguousSave && (
                          <button
                            type="button"
                            onClick={startOver}
                            className="rounded-control bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent-hover"
                          >
                            Choose another photo
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => closeFlow(false)}
                          className={`${ambiguousSave ? "bg-accent font-semibold text-white hover:bg-accent-hover" : "border border-hairline bg-white font-medium text-body hover:bg-wash"} rounded-control px-4 py-2 text-[13px]`}
                        >
                          {ambiguousSave ? "Close and check inventory" : "Close"}
                        </button>
                      </div>
                    </div>
                  )}

                  {step === "success" && (
                    <div className="grid justify-items-start gap-4 py-4" role="status">
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-new-soft text-xl font-semibold text-new">
                        ✓
                      </span>
                      <div>
                        <h3 className="m-0 text-base font-semibold text-ink">
                          {savedCount} {savedCount === 1 ? "item" : "items"} added
                        </h3>
                        <p className="m-0 mt-2 max-w-lg text-xs leading-relaxed text-muted">
                          Your confirmed inventory is refreshing now. The photo and review details have been discarded.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => closeFlow(false)}
                        className="rounded-control bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent-hover"
                      >
                        Done
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
