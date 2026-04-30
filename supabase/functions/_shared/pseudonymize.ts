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

/** Replace common PII patterns (emails) with pseudonyms in a free-text string (level A). */
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

/**
 * Level-B pseudonymization for student productions (written or transcribed).
 * Removes self-introductions, common French name patterns, emails, phone numbers,
 * and any names/firstnames passed via `knownNames` (matched word-bound, case-insensitive).
 *
 * Throws if AI_PSEUDONYM_SECRET is missing — caller MUST block the AI call in that case.
 */
export async function pseudonymizeProductionText(
  text: string,
  knownNames: Array<string | null | undefined> = [],
): Promise<string> {
  if (!text) return text;
  if (!hasPseudonymSecret()) {
    throw new Error("AI_PSEUDONYM_SECRET is not configured");
  }

  let out = text;

  // 1. Emails
  out = await pseudonymizeText(out);

  // 2. Téléphones FR (formats courants : 06 12 34 56 78, +33 6 12..., 0612345678)
  const phoneRe = /(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}/g;
  out = out.replace(phoneRe, "[TEL]");

  // 3. Patterns d'auto-présentation : capture le mot/groupe qui suit.
  //    Remplace par un pseudonyme déterministe basé sur le contenu capturé.
  const introPatterns: Array<{ re: RegExp; prefix: string }> = [
    { re: /\bje\s+m['’]?\s*appelle\s+([A-ZÀ-ÖØ-Þ][\p{L}'’-]+(?:\s+[A-ZÀ-ÖØ-Þ][\p{L}'’-]+)?)/giu, prefix: "prenom" },
    { re: /\bmon\s+nom\s+(?:est|c['’]?est)\s+([A-ZÀ-ÖØ-Þ][\p{L}'’-]+(?:\s+[A-ZÀ-ÖØ-Þ][\p{L}'’-]+)?)/giu, prefix: "nom" },
    { re: /\bje\s+suis\s+([A-ZÀ-ÖØ-Þ][\p{L}'’-]+(?:\s+[A-ZÀ-ÖØ-Þ][\p{L}'’-]+)?)/giu, prefix: "prenom" },
    { re: /\bmon\s+pr[eé]nom\s+(?:est|c['’]?est)\s+([A-ZÀ-ÖØ-Þ][\p{L}'’-]+)/giu, prefix: "prenom" },
  ];

  for (const { re, prefix } of introPatterns) {
    const matches = Array.from(out.matchAll(re));
    for (const m of matches) {
      const captured = m[1];
      if (!captured) continue;
      const pseudo = await pseudonymize(captured, prefix);
      // Reconstruit le segment d'introduction en remplaçant juste le nom.
      out = out.split(m[0]).join(m[0].replace(captured, `[${pseudo}]`));
    }
  }

  // 4. Noms connus fournis par l'appelant (prénom et/ou nom du profil élève).
  for (const raw of knownNames) {
    if (!raw) continue;
    const parts = String(raw).split(/\s+/).filter((p) => p.length >= 2);
    for (const part of parts) {
      // Échappe les regex et matche en limite de mot, insensible à la casse.
      const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`\\b${escaped}\\b`, "giu");
      if (re.test(out)) {
        const pseudo = await pseudonymize(part, "name");
        out = out.replace(re, `[${pseudo}]`);
      }
    }
  }

  return out;
}
