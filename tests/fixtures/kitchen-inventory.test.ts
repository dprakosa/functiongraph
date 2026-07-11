import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const fixturePath = resolve("tests/fixtures/kitchen-inventory.webp");

describe("safe photo inventory fixture", () => {
  it("is a stable metadata-free WebP within the scan contract", async () => {
    const bytes = await readFile(fixturePath);
    const metadata = await sharp(bytes, { failOn: "error" }).metadata();

    expect(bytes.byteLength).toBeLessThan(2.5 * 1024 * 1024);
    expect(metadata).toMatchObject({
      format: "webp",
      width: 1536,
      height: 1024,
      hasAlpha: false,
    });
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
    expect(metadata.iptc).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      "32e1e2160a1e1de7e256c0c087c2759cc2c8ffd6d57d975ab6e6851108593543",
    );
  });
});
