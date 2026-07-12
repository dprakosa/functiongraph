import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActiveInventoryState } from "../../inventory/useActiveInventory";
import type { InventoryScanCandidate } from "../../lib/types";

const mutationMocks = vi.hoisted(() => ({
  scanInventoryPhoto: vi.fn(),
  confirmInventoryItems: vi.fn(),
}));

vi.mock("../../inventory/inventoryMutations", async () => {
  const actual = await vi.importActual<
    typeof import("../../inventory/inventoryMutations")
  >("../../inventory/inventoryMutations");
  return {
    ...actual,
    scanInventoryPhoto: mutationMocks.scanInventoryPhoto,
    confirmInventoryItems: mutationMocks.confirmInventoryItems,
  };
});

import { InventoryMutationError } from "../../inventory/inventoryMutations";
import { PhotoInventoryFlow } from "./PhotoInventoryFlow";

const KETTLE: InventoryScanCandidate = {
  id: "candidate-1",
  name: "Electric kettle",
  quantity: 1,
  suggestedDomain: "kitchen",
  confidence: "high",
  evidence: "A kettle-shaped appliance is visible beside the sink.",
  capabilities: [
    { name: "boils water", tier: "primary" },
    { name: "pours hot water", tier: "secondary" },
  ],
};

const TOASTER: InventoryScanCandidate = {
  id: "candidate-2",
  name: "Two-slice toaster",
  quantity: null,
  suggestedDomain: "kitchen",
  confidence: "medium",
  evidence: "A two-slot appliance is visible on the counter.",
  capabilities: [{ name: "toasts bread", tier: "primary" }],
};

function guestInventory(retry = vi.fn()): ActiveInventoryState {
  return { status: "guest", items: [], retry };
}

function emptyInventory(retry = vi.fn()): ActiveInventoryState {
  return { status: "empty", items: [], retry };
}

function validPhoto(name = "kitchen.jpg"): File {
  return new File(["synthetic image bytes"], name, { type: "image/jpeg" });
}

function photoInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("photo input was not rendered");
  return input;
}

async function openSignedInFlow(
  inventory: ActiveInventoryState = emptyInventory(),
) {
  const user = userEvent.setup();
  render(<PhotoInventoryFlow inventory={inventory} />);
  await user.click(screen.getByRole("button", { name: "Add from photo" }));
  return user;
}

async function submitPhoto(
  user: ReturnType<typeof userEvent.setup>,
  file = validPhoto(),
  roomHint?: string,
) {
  await user.upload(photoInput(), file);
  if (roomHint) {
    await user.type(screen.getByLabelText(/Room hint/i), roomHint);
  }
  await user.click(screen.getByRole("button", { name: "Scan photo" }));
}

describe("PhotoInventoryFlow", () => {
  beforeEach(() => {
    mutationMocks.scanInventoryPhoto.mockReset();
    mutationMocks.confirmInventoryItems.mockReset();
    mutationMocks.confirmInventoryItems.mockResolvedValue(undefined);
  });

  it("gates guests behind the account prompt before rendering a file input", async () => {
    const user = userEvent.setup();
    render(<PhotoInventoryFlow inventory={guestInventory()} />);

    expect(document.querySelector('input[type="file"]')).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add from photo" }));

    expect(
      screen.getByRole("heading", { name: "Sign in to add your inventory" }),
    ).toBeVisible();
    expect(document.querySelector('input[type="file"]')).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to sign in" })).toHaveAttribute(
      "href",
      "/settings",
    );
    expect(mutationMocks.scanInventoryPhoto).not.toHaveBeenCalled();
  });

  it("keeps reverse tab navigation inside the dialog from its initial focus", async () => {
    await openSignedInFlow();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveFocus();

    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });

    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("scans, reviews, confirms only selected DM-9 fields, refreshes, and succeeds", async () => {
    const retry = vi.fn();
    mutationMocks.scanInventoryPhoto.mockResolvedValue({
      items: [KETTLE, TOASTER],
      warnings: ["Approximate quantities need review."],
      needsReview: true,
    });
    const user = await openSignedInFlow(emptyInventory(retry));

    await submitPhoto(user, validPhoto(), "kitchen counter");

    await waitFor(() => expect(mutationMocks.scanInventoryPhoto).toHaveBeenCalledOnce());
    const [imageDataUrl, roomHint, scanSignal] =
      mutationMocks.scanInventoryPhoto.mock.calls[0];
    expect(imageDataUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(roomHint).toBe("kitchen counter");
    expect(scanSignal).toBeInstanceOf(AbortSignal);

    expect(
      await screen.findByRole("heading", { name: "Review detected items" }),
    ).toBeVisible();
    expect(screen.getByText("Approximate quantities need review.")).toBeVisible();
    expect(screen.getByText(/kettle-shaped appliance/i)).toBeVisible();
    expect(screen.getByText("boils water")).toBeVisible();

    const selectionControls = screen.getAllByRole("checkbox");
    await user.click(selectionControls[0]);

    const names = screen.getAllByLabelText("Name");
    await user.clear(names[0]);
    await user.type(names[0], "Travel kettle");
    await user.selectOptions(screen.getAllByLabelText("Room")[0], "electronics");
    const quantities = screen.getAllByLabelText("Quantity");
    await user.clear(quantities[0]);
    await user.type(quantities[0], "3");

    await user.click(screen.getByRole("button", { name: "Add 1 item" }));

    await waitFor(() =>
      expect(mutationMocks.confirmInventoryItems).toHaveBeenCalledOnce(),
    );
    const [confirmed, confirmSignal] =
      mutationMocks.confirmInventoryItems.mock.calls[0];
    expect(confirmed).toEqual([
      {
        name: "Travel kettle",
        domain: "electronics",
        quantity: 3,
        capabilities: [
          { name: "boils water", tier: "primary" },
          { name: "pours hot water", tier: "secondary" },
        ],
      },
    ]);
    expect(confirmSignal).toBeInstanceOf(AbortSignal);
    expect(JSON.stringify(confirmed)).not.toMatch(
      /candidate-1|confidence|evidence|warnings|imageDataUrl/,
    );
    expect(retry).toHaveBeenCalledOnce();
    expect(
      await screen.findByRole("heading", { name: "1 item added" }),
    ).toBeVisible();
    expect(screen.getByText(/photo and review details have been discarded/i)).toBeVisible();
  });

  it("requires an active room before an unclassified candidate can be confirmed", async () => {
    mutationMocks.scanInventoryPhoto.mockResolvedValue({
      items: [{ ...KETTLE, suggestedDomain: "unclassified" }],
      warnings: [],
      needsReview: true,
    });
    const user = await openSignedInFlow();

    await submitPhoto(user);
    await screen.findByRole("heading", { name: "Review detected items" });

    await user.click(screen.getByRole("checkbox"));
    const confirmButton = screen.getByRole("button", { name: "Add 1 item" });
    expect(screen.getByLabelText("Room")).toHaveValue("");
    expect(confirmButton).toBeDisabled();
    expect(screen.getByText(/Give every selected item a name, room/i)).toBeVisible();

    await user.selectOptions(screen.getByLabelText("Room"), "garage");
    expect(confirmButton).toBeEnabled();
  });

  it("does not let invalid fields on a deselected candidate block confirmation", async () => {
    mutationMocks.scanInventoryPhoto.mockResolvedValue({
      items: [KETTLE, TOASTER],
      warnings: [],
      needsReview: true,
    });
    const user = await openSignedInFlow();

    await submitPhoto(user);
    await screen.findByRole("heading", { name: "Review detected items" });
    const selections = screen.getAllByRole("checkbox");
    await user.click(selections[0]);
    const quantities = screen.getAllByLabelText("Quantity");
    await user.clear(quantities[0]);
    await user.type(quantities[0], "0");
    await user.click(selections[0]);
    await user.click(selections[1]);

    await user.click(screen.getByRole("button", { name: "Add 1 item" }));

    await waitFor(() =>
      expect(mutationMocks.confirmInventoryItems).toHaveBeenCalledWith(
        [
          {
            name: TOASTER.name,
            domain: "kitchen",
            quantity: null,
            capabilities: TOASTER.capabilities,
          },
        ],
        expect.any(AbortSignal),
      ),
    );
  });

  it("rejects unsupported and oversized files before scanning", async () => {
    const user = await openSignedInFlow();
    const gif = new File(["gif"], "inventory.gif", { type: "image/gif" });

    fireEvent.change(photoInput(), { target: { files: [gif] } });
    expect(await screen.findByText("That photo format is not supported")).toBeVisible();
    expect(screen.getByText(/JPEG, PNG, or WebP/)).toBeVisible();
    expect(mutationMocks.scanInventoryPhoto).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Choose another photo" }));
    const oversized = new File(["x"], "large.webp", { type: "image/webp" });
    Object.defineProperty(oversized, "size", {
      configurable: true,
      value: 2.5 * 1024 * 1024 + 1,
    });
    fireEvent.change(photoInput(), { target: { files: [oversized] } });

    expect(await screen.findByText("That photo is too large")).toBeVisible();
    expect(screen.getByText(/smaller than 2.5 MiB/i)).toBeVisible();
    expect(mutationMocks.scanInventoryPhoto).not.toHaveBeenCalled();
  });

  it("shows the successful empty-result state without offering confirmation", async () => {
    mutationMocks.scanInventoryPhoto.mockResolvedValue({
      items: [],
      warnings: ["No recognizable objects were found."],
      needsReview: true,
    });
    const user = await openSignedInFlow();

    await submitPhoto(user);

    expect(
      await screen.findByRole("heading", { name: "No household items found" }),
    ).toBeVisible();
    expect(screen.getByText("No recognizable objects were found.")).toBeVisible();
    expect(mutationMocks.confirmInventoryItems).not.toHaveBeenCalled();
  });

  it("renders a distinct rate-limit state for a 429 scan failure", async () => {
    mutationMocks.scanInventoryPhoto.mockRejectedValue(
      new InventoryMutationError(
        "too many photo scans from this account",
        "Wait a minute before scanning another photo.",
        429,
      ),
    );
    const user = await openSignedInFlow();

    await submitPhoto(user);

    expect(
      await screen.findByRole("heading", {
        name: "Too many photo scans from this account",
      }),
    ).toBeVisible();
    expect(screen.getByText(/scan limit protects the shared service/i)).toBeVisible();
    expect(mutationMocks.confirmInventoryItems).not.toHaveBeenCalled();
  });

  it("refreshes inventory and prevents a blind rescan after an ambiguous save failure", async () => {
    const retry = vi.fn();
    mutationMocks.scanInventoryPhoto.mockResolvedValue({
      items: [KETTLE],
      warnings: [],
      needsReview: true,
    });
    mutationMocks.confirmInventoryItems.mockRejectedValue(
      new Error("response connection was lost"),
    );
    const user = await openSignedInFlow(emptyInventory(retry));

    await submitPhoto(user);
    await screen.findByRole("heading", { name: "Review detected items" });
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Add 1 item" }));

    expect(
      await screen.findByRole("button", { name: "Close and check inventory" }),
    ).toBeVisible();
    expect(retry).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("button", { name: "Choose another photo" }),
    ).not.toBeInTheDocument();
    expect(mutationMocks.confirmInventoryItems).toHaveBeenCalledOnce();
  });

  it("aborts and discards an open scan when the active identity changes", async () => {
    let capturedSignal: AbortSignal | undefined;
    mutationMocks.scanInventoryPhoto.mockImplementation(
      (_image: string, _hint: string | undefined, signal: AbortSignal) => {
        capturedSignal = signal;
        return new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            reject(new DOMException("cancelled", "AbortError"));
          });
        });
      },
    );
    const inventory = emptyInventory();
    const user = userEvent.setup();
    const { rerender } = render(
      <PhotoInventoryFlow inventory={inventory} identityKey="user-a:session-a" />,
    );
    await user.click(screen.getByRole("button", { name: "Add from photo" }));
    await submitPhoto(user);
    expect(await screen.findByText("Finding household items")).toBeVisible();

    rerender(
      <PhotoInventoryFlow inventory={inventory} identityKey="user-b:session-b" />,
    );

    await waitFor(() => expect(capturedSignal?.aborted).toBe(true));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByText("Photo scan cleared because the active account changed."),
    ).toBeInTheDocument();
  });

  it("aborts a pending scan and clears the selected photo and draft on cancel", async () => {
    let capturedSignal: AbortSignal | undefined;
    mutationMocks.scanInventoryPhoto.mockImplementation(
      (_image: string, _hint: string | undefined, signal: AbortSignal) => {
        capturedSignal = signal;
        return new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            reject(new DOMException("cancelled", "AbortError"));
          });
        });
      },
    );
    const user = await openSignedInFlow();

    await submitPhoto(user, validPhoto("private-photo.jpg"), "private room");
    expect(await screen.findByText("Finding household items")).toBeVisible();
    expect(capturedSignal?.aborted).toBe(false);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(capturedSignal?.aborted).toBe(true));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Photo scan cancelled.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add from photo" }));
    expect(screen.getByText("Choose or take a photo")).toBeVisible();
    expect(screen.getByLabelText(/Room hint/i)).toHaveValue("");
    expect(screen.getByRole("button", { name: "Scan photo" })).toBeDisabled();
  });

  it("disables the trigger while inventory is loading or unavailable", () => {
    const retry = vi.fn();
    const { rerender } = render(
      <PhotoInventoryFlow inventory={{ status: "loading", items: null, retry }} />,
    );

    expect(screen.getByRole("button", { name: "Add from photo" })).toBeDisabled();
    rerender(
      <PhotoInventoryFlow
        inventory={{
          status: "error",
          items: null,
          error: "inventory unavailable",
          hint: "Try again later.",
          retry,
        }}
      />,
    );
    expect(screen.getByRole("button", { name: "Add from photo" })).toBeDisabled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
