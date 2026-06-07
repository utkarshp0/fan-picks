import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  createShareImageMetadata,
  createShareImageUrl,
  getAppBaseUrl,
} from "../src/lib/share-metadata";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.VERCEL_URL;
});

describe("share metadata", () => {
  it("builds code-specific Open Graph image URLs", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://example.test/";

    const url = createShareImageUrl("pool", "FP-01KIT9");

    assert.equal(
      url,
      "https://example.test/api/share-image?kind=pool&v=2&code=FP-01KIT9",
    );
  });

  it("includes large image dimensions and png type for previews", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://example.test";

    assert.deepEqual(createShareImageMetadata("match", "MP-123456"), {
      alt: "Fan Picks match prediction invite",
      height: 630,
      type: "image/png",
      url: "https://example.test/api/share-image?kind=match&v=2&code=MP-123456",
      width: 1200,
    });
  });

  it("uses Vercel URL when no explicit app URL is configured", () => {
    process.env.VERCEL_URL = "fan-picks-git-main.vercel.app";

    assert.equal(getAppBaseUrl(), "https://fan-picks-git-main.vercel.app");
  });
});
