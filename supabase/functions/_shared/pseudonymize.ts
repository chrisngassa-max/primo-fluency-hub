// HMAC-SHA256 deterministic pseudonymization for PII before sending to AI providers.
// AI_PSEUDONYM_SECRET is REQUIRED. No fallback. If absent, calls MUST be blocked
// at the call site by checking `hasPseudonymSecret()`.

const SECRET = Deno.env.get("AI_PSEUDONYM_SECRET");

export function hasPseudonymSecret(): boolean {
  return typeof SECRET === "string" && SECRET.length >= 16;
}

async function hmac(input: string): Promise<string> {
  if (!hasPseudonymSecret()) {
    throw new Error("AI_PSEUDONYM_SECRET is not configured");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET!),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

export async function pseudonymize(value: string | null | undefined, prefix = "u"): Promise<string> {
  if (!value) return "";
  const h = await hmac(value.toLowerCase().trim());
  return `${prefix}_${h}`;
}

/** Replace common PII patterns (emails) with pseudonyms in a free-text string. */
export async function pseudonymizeText(text: string): Promise<string> {
  if (!text) return text;
  let out = text;
  const emailRe = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = Array.from(new Set(out.match(emailRe) ?? []));
  for (const e of emails) {
    out = out.split(e).join(await pseudonymize(e, "email"));
  }
  return out;
}
