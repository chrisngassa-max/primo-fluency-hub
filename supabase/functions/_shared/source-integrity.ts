export type Sha256ContentHash = `sha256:${string}`;

export function bytesToLowerHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256ContentHash(bytes: Uint8Array): Promise<Sha256ContentHash> {
  const source = new Uint8Array(bytes.byteLength);
  source.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", source);
  return `sha256:${bytesToLowerHex(new Uint8Array(digest))}`;
}

export function isSha256ContentHash(value: unknown): value is Sha256ContentHash {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
}
