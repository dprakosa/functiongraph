import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ConfirmedInventoryItemInput,
  InventoryScanResult,
} from "../lib/types";
import {
  confirmInventoryItems,
  InventoryMutationError,
  scanInventoryPhoto,
  updateInventoryItem,
} from "./inventoryMutations";

const SCAN_RESULT: InventoryScanResult = {
  items: [
    {
      id: "candidate-1",
      name: "Two-slot toaster",
      quantity: 1,
      suggestedDomain: "kitchen",
      confidence: "high",
      evidence: "A toaster is visible on the counter.",
      capabilities: [
        { name: "toasts bread", tier: "primary" },
        { name: "warms sliced bread", tier: "secondary" },
      ],
    },
  ],
  warnings: ["Approximate quantity — please review."],
  needsReview: true,
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function installFetchMock() {
  const fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("personal inventory mutation client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("posts a photo scan with the optional room hint and returns a validated draft", async () => {
    const fetchMock = installFetchMock();
    const controller = new AbortController();
    fetchMock.mockResolvedValueOnce(jsonResponse(SCAN_RESULT));

    await expect(
      scanInventoryPhoto(
        "data:image/webp;base64,aW1hZ2U=",
        "kitchen",
        controller.signal,
      ),
    ).resolves.toEqual(SCAN_RESULT);

    expect(fetchMock).toHaveBeenCalledWith("/api/inventory/scan", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        imageDataUrl: "data:image/webp;base64,aW1hZ2U=",
        roomHint: "kitchen",
      }),
      signal: controller.signal,
    });
  });

  it("omits an absent room hint from the scan request", async () => {
    const fetchMock = installFetchMock();
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...SCAN_RESULT, items: [] }));

    await scanInventoryPhoto("data:image/png;base64,aW1hZ2U=");

    const request = fetchMock.mock.calls[0]?.[1];
    expect(JSON.parse(String(request?.body))).toEqual({
      imageDataUrl: "data:image/png;base64,aW1hZ2U=",
    });
  });

  it("posts only persistent reviewed fields when confirming candidates", async () => {
    const fetchMock = installFetchMock();
    const controller = new AbortController();
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }, 201));
    const reviewedWithProvisionalFields = {
      name: "Countertop toaster",
      domain: "kitchen",
      quantity: 1,
      capabilities: [
        {
          name: "toasts bread",
          tier: "primary",
          confidence: "high",
        },
      ],
      id: "candidate-1",
      suggestedDomain: "kitchen",
      confidence: "high",
      evidence: "A toaster is visible on the counter.",
    } as unknown as ConfirmedInventoryItemInput;

    await confirmInventoryItems(
      [reviewedWithProvisionalFields],
      controller.signal,
    );

    expect(fetchMock).toHaveBeenCalledWith("/api/inventory/items", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            name: "Countertop toaster",
            domain: "kitchen",
            quantity: 1,
            capabilities: [{ name: "toasts bread", tier: "primary" }],
          },
        ],
      }),
      signal: controller.signal,
    });
  });

  it("rejects a malformed successful scan response before the UI can consume it", async () => {
    const fetchMock = installFetchMock();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ...SCAN_RESULT,
        items: [{ ...SCAN_RESULT.items[0], confidence: "certain" }],
      }),
    );

    await expect(
      scanInventoryPhoto("data:image/jpeg;base64,aW1hZ2U="),
    ).rejects.toMatchObject({
      name: "InventoryMutationError",
      message: "the photo scan returned invalid data",
      status: null,
    });
  });

  it("preserves a shaped scan failure and its HTTP status", async () => {
    const fetchMock = installFetchMock();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          error: "too many photo scans from this account",
          hint: "wait a minute before scanning another photo",
        },
        429,
      ),
    );

    const failure = await scanInventoryPhoto(
      "data:image/jpeg;base64,aW1hZ2U=",
    ).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(InventoryMutationError);
    expect(failure).toMatchObject({
      message: "too many photo scans from this account",
      hint: "wait a minute before scanning another photo",
      status: 429,
    });
  });

  it("uses the same shaped status error for confirmation and existing mutations", async () => {
    const fetchMock = installFetchMock();
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: "the inventory confirmation needs selected items",
            hint: "select at least one reviewed item",
          },
          400,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: "personal inventory is temporarily unavailable",
            hint: "wait a moment and try again",
          },
          503,
        ),
      );

    await expect(confirmInventoryItems([])).rejects.toMatchObject({
      message: "the inventory confirmation needs selected items",
      hint: "select at least one reviewed item",
      status: 400,
    });
    await expect(
      updateInventoryItem("inventory-id", { quantity: 2 }),
    ).rejects.toMatchObject({
      message: "personal inventory is temporarily unavailable",
      status: 503,
    });
  });
});
