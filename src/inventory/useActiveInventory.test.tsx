import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import inventoryFile from "../data/inventory.json";
import type { OwnedInventoryItem } from "../lib/types";
import { useActiveInventory } from "./useActiveInventory";

const PERSONAL_ITEMS: OwnedInventoryItem[] = [
  {
    id: "desk-lamp",
    name: "Desk lamp",
    domain: "electronics",
    quantity: 1,
    capabilities: [
      { name: "lights a desk", tier: "primary" },
      { name: "adds ambient light", tier: "secondary" },
    ],
    source: "photo",
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z",
  },
];

function jsonResponse(payload: unknown, ok = true): Response {
  return {
    ok,
    json: vi.fn().mockResolvedValue(payload),
  } as unknown as Response;
}

function installFetchMock() {
  const fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("useActiveInventory", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns bundled inventory for guests without fetching", () => {
    const fetchMock = installFetchMock();
    const { result } = renderHook(() => useActiveInventory("guest"));

    expect(result.current.status).toBe("guest");
    expect(result.current.items).toEqual(inventoryFile.items);

    act(() => result.current.retry());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stays loading while a signed-in request is pending, then returns its items", async () => {
    const fetchMock = installFetchMock();
    const request = deferred<Response>();
    fetchMock.mockReturnValueOnce(request.promise);

    const { result } = renderHook(() => useActiveInventory("signed-in"));

    expect(result.current).toMatchObject({ status: "loading", items: null });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/inventory/items",
      expect.objectContaining({
        method: "GET",
        credentials: "same-origin",
        headers: { accept: "application/json" },
        signal: expect.anything(),
      }),
    );

    await act(async () => {
      request.resolve(jsonResponse({ items: PERSONAL_ITEMS }));
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        status: "populated",
        items: PERSONAL_ITEMS,
      });
    });
  });

  it("returns an empty state for a signed-in inventory with no items", async () => {
    const fetchMock = installFetchMock();
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }));

    const { result } = renderHook(() => useActiveInventory("signed-in"));

    await waitFor(() => {
      expect(result.current).toMatchObject({ status: "empty", items: [] });
    });
  });

  it("reloads instead of retaining inventory when the signed-in identity changes", async () => {
    const fetchMock = installFetchMock();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ items: PERSONAL_ITEMS }))
      .mockResolvedValueOnce(jsonResponse({ items: [] }));

    const { result, rerender } = renderHook(
      ({ identityKey }) => useActiveInventory("signed-in", identityKey),
      { initialProps: { identityKey: "user-a:session-a" } },
    );

    await waitFor(() => {
      expect(result.current.status).toBe("populated");
    });

    rerender({ identityKey: "user-b:session-b" });

    expect(result.current.status).toBe("loading");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.current.status).toBe("empty");
    });
  });

  it("keeps a shaped HTTP error and retries with a second request", async () => {
    const fetchMock = installFetchMock();
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: "inventory is temporarily unavailable",
            hint: "Wait a moment, then try again.",
          },
          false,
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ items: PERSONAL_ITEMS }));

    const { result } = renderHook(() => useActiveInventory("signed-in"));

    await waitFor(() => {
      expect(result.current).toMatchObject({
        status: "error",
        items: null,
        error: "inventory is temporarily unavailable",
        hint: "Wait a moment, then try again.",
      });
    });

    act(() => result.current.retry());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => {
      expect(result.current).toMatchObject({
        status: "populated",
        items: PERSONAL_ITEMS,
      });
    });
  });

  it("reports a malformed successful payload as a retryable error", async () => {
    const fetchMock = installFetchMock();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: [{ id: "missing-required-fields" }] }),
    );

    const { result } = renderHook(() => useActiveInventory("signed-in"));

    await waitFor(() => {
      expect(result.current).toMatchObject({
        status: "error",
        items: null,
        error: "inventory response was not valid",
        hint: "Check your connection and try loading your inventory again.",
      });
    });
  });

  it("rejects personal rows with malformed ownership metadata", async () => {
    const fetchMock = installFetchMock();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [{ ...PERSONAL_ITEMS[0], source: "guest", createdAt: "not-a-date" }],
      }),
    );

    const { result } = renderHook(() => useActiveInventory("signed-in"));

    await waitFor(() => {
      expect(result.current).toMatchObject({
        status: "error",
        items: null,
        error: "inventory response was not valid",
      });
    });
  });

  it("reports a network failure without falling back to guest inventory", async () => {
    const fetchMock = installFetchMock();
    fetchMock.mockRejectedValueOnce(new Error("network unavailable"));

    const { result } = renderHook(() => useActiveInventory("signed-in"));

    await waitFor(() => {
      expect(result.current).toMatchObject({
        status: "error",
        items: null,
        error: "network unavailable",
        hint: "Check your connection and try loading your inventory again.",
      });
    });
    expect(result.current.items).not.toEqual(inventoryFile.items);
  });
});
