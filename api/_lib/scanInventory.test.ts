import sharp from "sharp";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  handleInventoryScan,
  resetInventoryScanRateLimitForTests,
} from "./scanInventory";

let jpegDataUrl: string;
let pngDataUrl: string;
let overPixelLimitDataUrl: string;

const scanResult = {
  items: [
    {
      name: "Toaster",
      quantity: 1,
      suggestedDomain: "kitchen",
      confidence: "high",
      evidence: "Two bread slots and a browning lever are visible.",
      capabilities: [{ name: "toasts bread", tier: "primary" }],
    },
  ],
  warnings: [],
};

function response(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}

function installChatMock(result: unknown = scanResult) {
  const mock = vi.fn(async (url: string | URL, init?: RequestInit) => {
    if (!String(url).endsWith("/chat/completions")) {
      throw new Error(`unexpected URL: ${String(url)}`);
    }
    return response({
      choices: [{ message: { content: JSON.stringify(result) } }],
    });
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

beforeAll(async () => {
  const jpeg = await sharp({
    create: { width: 24, height: 16, channels: 3, background: "#d25b4b" },
  }).jpeg().toBuffer();
  const png = await sharp({
    create: { width: 24, height: 16, channels: 4, background: "#d25b4b" },
  }).png().toBuffer();
  const overPixelLimit = await sharp({
    create: { width: 6400, height: 6300, channels: 3, background: "#ffffff" },
  }).jpeg({ quality: 1 }).toBuffer();
  jpegDataUrl = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  pngDataUrl = `data:image/png;base64,${png.toString("base64")}`;
  overPixelLimitDataUrl = `data:image/jpeg;base64,${overPixelLimit.toString("base64")}`;
});

beforeEach(() => {
  resetInventoryScanRateLimitForTests();
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubEnv("OPENAI_MODEL", "gpt-4.1-mini-2025-04-14");
  vi.stubEnv("OPENAI_VISION_MODEL", "gpt-4.1-mini-2025-04-14");
  vi.stubEnv("OPENAI_EMBED_MODEL", "text-embedding-3-small");
  vi.stubEnv("OPENAI_EMBED_REVISION", `scan-test-${Math.random()}`);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("inventory photo input validation", () => {
  it.each([
    [undefined, 400],
    [{}, 400],
    [{ imageDataUrl: "https://example.com/photo.jpg" }, 400],
    [{ imageDataUrl: "data:image/jpeg;base64,%%%" }, 400],
    [{ imageDataUrl: "data:image/gif;base64,R0lGODlh" }, 415],
    [{ imageDataUrl: "data:image/jpeg;base64,aW1hZ2U" }, 400],
    [{ imageDataUrl: "data:image/jpeg;base64,aW1hZ2U=", roomHint: "x".repeat(81) }, 400],
  ])("rejects an invalid request without calling the provider", async (body, status) => {
    const fetchMock = installChatMock();
    const result = await handleInventoryScan(body, "user_invalid");
    expect(result.status).toBe(status);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.body).toHaveProperty("hint");
  });

  it("rejects decoded payloads above 2.5 MiB", async () => {
    const encoded = Buffer.alloc(Math.floor(2.5 * 1024 * 1024) + 1).toString("base64");
    const result = await handleInventoryScan(
      { imageDataUrl: `data:image/jpeg;base64,${encoded}` },
      "user_large",
    );
    expect(result.status).toBe(413);
  });

  it("rejects MIME/content mismatches", async () => {
    const result = await handleInventoryScan(
      { imageDataUrl: pngDataUrl.replace("image/png", "image/jpeg") },
      "user_mismatch",
    );
    expect(result.status).toBe(415);
  });

  it("rejects images above 40 megapixels even when their file is small", async () => {
    const result = await handleInventoryScan(
      { imageDataUrl: overPixelLimitDataUrl },
      "user_too_many_pixels",
    );
    expect(result.status).toBe(413);
  });
});

describe("inventory photo detection", () => {
  it("preprocesses to JPEG and sends a private one-pass structured vision request", async () => {
    const fetchMock = installChatMock();
    const result = await handleInventoryScan(
      { imageDataUrl: pngDataUrl, roomHint: " kitchen " },
      "user_private_123",
    );

    expect(result).toEqual({
      status: 200,
      body: {
        items: [
          {
            id: "candidate-1",
            name: "Toaster",
            quantity: 1,
            suggestedDomain: "kitchen",
            confidence: "high",
            evidence: "Two bread slots and a browning lever are visible.",
            capabilities: [{ name: "toasts bread", tier: "primary" }],
          },
        ],
        warnings: [],
        needsReview: true,
      },
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const payload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(payload.model).toBe("gpt-4.1-mini-2025-04-14");
    expect(payload.store).toBe(false);
    expect(payload.safety_identifier).toMatch(/^[a-f0-9]{64}$/);
    expect(payload.safety_identifier).not.toContain("user_private_123");
    expect(payload.response_format.json_schema.strict).toBe(true);
    const image = payload.messages[1].content[1].image_url;
    expect(image.detail).toBe("high");
    expect(image.url).toMatch(/^data:image\/jpeg;base64,/);
    expect(image.url).not.toBe(pngDataUrl);
    expect(payload.messages[1].content[0].text).toContain("kitchen");
  });

  it("returns a successful empty review draft when nothing is recognized", async () => {
    installChatMock({ items: [], warnings: ["No household objects were clear enough."] });
    const result = await handleInventoryScan({ imageDataUrl: jpegDataUrl }, "user_empty");
    expect(result).toEqual({
      status: 200,
      body: {
        items: [],
        warnings: ["No household objects were clear enough."],
        needsReview: true,
      },
    });
  });

  it("fails the whole response when provider data violates the contract", async () => {
    installChatMock({ ...scanResult, items: [{ ...scanResult.items[0], confidence: "certain" }] });
    const result = await handleInventoryScan({ imageDataUrl: jpegDataUrl }, "user_bad_output");
    expect(result.status).toBe(503);
    expect(result.body).toEqual(expect.objectContaining({ hint: expect.any(String) }));
  });

  it("maps a model refusal to a reviewable 422", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response({
      choices: [{ message: { content: "", refusal: "Cannot inspect this image." } }],
    })));
    const result = await handleInventoryScan({ imageDataUrl: jpegDataUrl }, "user_refusal");
    expect(result.status).toBe(422);
  });

  it("uses OPENAI_MODEL when no separate vision snapshot is configured", async () => {
    vi.stubEnv("OPENAI_VISION_MODEL", "");
    const fetchMock = installChatMock();
    await handleInventoryScan({ imageDataUrl: jpegDataUrl }, "user_fallback");
    const payload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(payload.model).toBe("gpt-4.1-mini-2025-04-14");
  });

  it("requires a pinned vision snapshot", async () => {
    vi.stubEnv("OPENAI_VISION_MODEL", "gpt-4.1-mini");
    const fetchMock = installChatMock();
    const result = await handleInventoryScan({ imageDataUrl: jpegDataUrl }, "user_config");
    expect(result.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows three provider calls per Clerk user per minute", async () => {
    const fetchMock = installChatMock();
    for (let index = 0; index < 3; index += 1) {
      expect((await handleInventoryScan({ imageDataUrl: jpegDataUrl }, "user_rate", 10_000)).status).toBe(200);
    }
    const limited = await handleInventoryScan({ imageDataUrl: jpegDataUrl }, "user_rate", 10_000);
    expect(limited.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const otherUser = await handleInventoryScan({ imageDataUrl: jpegDataUrl }, "user_other", 10_000);
    expect(otherUser.status).toBe(200);
  });

  it("batches unmatched capabilities across all candidates into one embeddings call", async () => {
    const result = {
      items: [
        { ...scanResult.items[0], capabilities: [{ name: "warms sliced bread", tier: "primary" }] },
        { ...scanResult.items[0], name: "Second toaster", capabilities: [{ name: "warms sliced bread", tier: "secondary" }] },
      ],
      warnings: [],
    };
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body));
      if (String(url).endsWith("/chat/completions")) {
        return response({ choices: [{ message: { content: JSON.stringify(result) } }] });
      }
      const inputs = payload.input as string[];
      return response({ data: inputs.map((_: string, index: number) => ({ index, embedding: [1, 0] })) });
    });
    vi.stubGlobal("fetch", fetchMock);

    const output = await handleInventoryScan({ imageDataUrl: jpegDataUrl }, "user_batch");
    expect(output.status).toBe(200);
    const embeddingPayloads = fetchMock.mock.calls
      .filter(([url]) => String(url).endsWith("/embeddings"))
      .map(([, init]) => JSON.parse(String(init?.body)));
    expect(embeddingPayloads).toHaveLength(2);
    expect(embeddingPayloads.find((payload) => payload.input.includes("warms sliced bread")).input).toEqual([
      "warms sliced bread",
    ]);
  });
});
