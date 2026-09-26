/**
 * Edge Function préparée — Lot 3B-3 Phase A.
 * NE PAS déployer sans autorisation Phase B.
 *
 * Garde-fous :
 * - JWT requis
 * - consent_ai (table existante ai_processing_consents) — pas de biométrie requise
 * - kill-switch CAPTCF_ASSISTANT_AI_ENABLED !== "true" → 503
 * - payload pédagogique uniquement (pas de PII)
 * - prompt grounded sur sources validées
 * - max tokens courts
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AIError, callAI } from "../_shared/ai-client.ts";
import {
  checkConsent,
  consentBlockedResponse,
  ensurePseudonymSecretOrLog,
  getUserIdFromAuth,
  logAICall,
} from "../_shared/check-consent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_OUTPUT_CHARS = 600;
const FORBIDDEN_PII_KEYS = [
  "eleve_id",
  "user_id",
  "email",
  "prenom",
  "nom",
  "telephone",
  "phone",
  "score",
  "password",
  "token",
];

const EVAL_LEAK_PATTERNS = [
  /bonne\s+r[ée]ponse/i,
  /la\s+r[ée]ponse\s+(est|exacte)/i,
  /corrig[ée]\s*:\s*/i,
];

type PreparedRequest = {
  question: string;
  intent: string;
  niveau: string;
  session: { code: string; titre: string; objectifs: string[] };
  lecon: { titre: string } | null;
  exercice: { titre: string; consigne: string | null; competence: string | null } | null;
  sources: {
    faits: string[];
    lexique: { mot: string; definition_simple: string; exemple: string }[];
    aides: string[];
    mini_exercice: string | null;
  };
  meta?: { corpus_version?: string };
};

function assertNoPii(payload: unknown): void {
  const json = JSON.stringify(payload);
  const lowered = json.toLowerCase();
  for (const key of FORBIDDEN_PII_KEYS) {
    if (lowered.includes(`"${key}"`)) {
      throw new Error(`pii_forbidden:${key}`);
    }
  }
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(json)) {
    throw new Error("pii_forbidden:email");
  }
}

function buildMessages(req: PreparedRequest) {
  const facts = (req.sources.faits ?? []).slice(0, 6).join("\n- ");
  const lex = (req.sources.lexique ?? [])
    .slice(0, 6)
    .map((m) => `${m.mot}: ${m.definition_simple} (ex. ${m.exemple})`)
    .join("\n- ");
  const aides = (req.sources.aides ?? []).slice(0, 4).join(" ; ");

  const system = `Tu es l'assistant pédagogique CapTCF (texte court).
Règles strictes :
1) Réponds UNIQUEMENT à partir des SOURCES VALIDÉES fournies. N'invente pas.
2) Adapte le français au niveau ${req.niveau}.
3) Intention demandée : ${req.intent}.
4) Interdit : donner la réponse d'une évaluation / QCM / corrigé.
5) Interdit : conseils administratifs (préfecture, délais, éligibilité).
6) Si les sources ne suffisent pas : dis-le clairement et propose de reformuler.
7) Réponse max ~90 mots, français simple.`;

  const user = `Séance : ${req.session.code} — ${req.session.titre}
Objectifs : ${(req.session.objectifs ?? []).join(" | ")}
Leçon : ${req.lecon?.titre ?? "—"}
Exercice : ${req.exercice?.titre ?? "—"}
Consigne : ${req.exercice?.consigne ?? "—"}
Compétence : ${req.exercice?.competence ?? "—"}

SOURCES VALIDÉES :
Faits :
- ${facts || "(aucun)"}

Lexique :
- ${lex || "(aucun)"}

Aides :
${aides || "(aucune)"}

Mini-exercice suggéré : ${req.sources.mini_exercice ?? "—"}

Question élève : ${req.question}`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

function sanitizeModelText(text: string): { text: string; uncertain: boolean } {
  let out = text.trim();
  if (out.length > MAX_OUTPUT_CHARS) out = `${out.slice(0, MAX_OUTPUT_CHARS - 1).trimEnd()}…`;
  const leak = EVAL_LEAK_PATTERNS.some((re) => re.test(out));
  if (leak) {
    return {
      text:
        "Je ne peux pas donner la réponse d’une évaluation. Relis la consigne et utilise un indice ou un exemple.",
      uncertain: true,
    };
  }
  return { text: out, uncertain: false };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const started = Date.now();
  let userId: string | null = null;

  try {
    // Kill-switch Phase B : sans ce flag serveur, aucun appel modèle.
    if (Deno.env.get("CAPTCF_ASSISTANT_AI_ENABLED") !== "true") {
      return new Response(
        JSON.stringify({
          error: "assistant_ai_disabled",
          message: "Assistant IA non autorisé en production (préflight Phase A).",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    userId = await getUserIdFromAuth(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const secretBlock = await ensurePseudonymSecretOrLog("captcf-assistant-qa", corsHeaders, userId);
    if (secretBlock) return secretBlock;

    const consent = await checkConsent({ userId, requireBiometric: false });
    if (!consent.ok) {
      await logAICall({
        function_name: "captcf-assistant-qa",
        subject_user_id: userId,
        triggered_by_user_id: userId,
        status: "blocked_no_consent",
        data_categories: ["pedagogical_context"],
        pseudonymization_level: "none",
        consent_version: consent.consentVersion,
      });
      return consentBlockedResponse(consent.reason ?? "consent_missing", corsHeaders);
    }

    const body = await req.json();
    const request = (body?.request ?? body) as PreparedRequest;
    if (!request?.question || !request?.session?.code) {
      return new Response(JSON.stringify({ error: "invalid_payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    assertNoPii(request);

    const model =
      Deno.env.get("CAPTCF_ASSISTANT_MODEL") ?? "google/gemini-2.5-flash-lite";

    const ai = await callAI({
      model,
      messages: buildMessages(request),
    });

    const raw = String(ai?.choices?.[0]?.message?.content ?? "").trim();
    if (!raw) throw new AIError("empty_assistant_response", 502);

    const { text, uncertain } = sanitizeModelText(raw);

    await logAICall({
      function_name: "captcf-assistant-qa",
      subject_user_id: userId,
      triggered_by_user_id: userId,
      status: "ok",
      provider: "lovable_or_gemini",
      model,
      data_categories: ["pedagogical_context"],
      pseudonymization_level: "none",
      duration_ms: Date.now() - started,
      consent_version: consent.consentVersion,
    });

    return new Response(JSON.stringify({ text, uncertain, model }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "error";
    await logAICall({
      function_name: "captcf-assistant-qa",
      subject_user_id: userId,
      triggered_by_user_id: userId,
      status: "error",
      data_categories: ["pedagogical_context"],
      pseudonymization_level: "none",
      duration_ms: Date.now() - started,
    });
    const status = message.startsWith("pii_forbidden") ? 400 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
