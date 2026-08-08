import { describe, expect, it } from "vitest";
import { bytesToLowerHex, isSha256ContentHash, sha256ContentHash } from "../../supabase/functions/_shared/source-integrity";

describe("pedagogical source integrity", () => {
  it("formats bytes as lowercase hexadecimal", () => {
    expect(bytesToLowerHex(new Uint8Array([0, 15, 16, 255]))).toBe("000f10ff");
  });

  it("computes the canonical prefixed SHA-256", async () => {
    const hash = await sha256ContentHash(new TextEncoder().encode("abc"));
    expect(hash).toBe("sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("recognizes only canonical content hashes", () => {
    expect(isSha256ContentHash("sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")).toBe(true);
    expect(isSha256ContentHash("BA7816BF")).toBe(false);
    expect(isSha256ContentHash(null)).toBe(false);
  });
});
