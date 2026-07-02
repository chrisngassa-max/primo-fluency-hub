import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { extractText, getDocumentProxy } from "npm:unpdf@0.12.1";
import { callAI, AIError } from "../_shared/ai-client.ts";
import {
  ensurePseudonymSecretOrLog,
  getUserIdFromAuth,
  logAICall,
} from "../_shared/check-consent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime-version",
};

/** Keep prompts within Lovable gateway limits (large PDFs were triggering fallback → Gemini 403). */
const PDF_TEXT_LIMITS = [12_000, 6_000, 3_000] as const;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function extractPdfText(pdfBase64: string): Promise<string> {
  const pdf = await getDocumentProxy(base64ToBytes(pdfBase64));
  const { text } = await extractText(pdf, { mergePages: true });
  return String(text || "").replace(/\s{2,}/g, " ").trim();
}

function buildAnalysisPrompt(fileName: string, targetLevel: string): string {
  return `Analyse ce support pedagogique PDF en francais.
Le but est de generer ensuite des exercices FLE fideles au document pour le niveau ${targetLevel || "A1"}.

Retourne uniquement un objet JSON avec :
- title : titre court du support
- theme : theme principal
- summary : synthese factuelle de 5000 caracteres maximum, utilisable comme source
- vocabulary : 10 a 30 mots ou expressions reellement presents dans le document
- grammar_points : points de grammaire ou structures observes
- learning_objectives : objectifs pedagogiques possibles
- detected_level : niveau CECRL estime

N'invente aucun contenu absent du PDF. Le nom du fichier est "${fileName || "support.pdf"}".`;
}

async function analyzeExtractedText(
  extracted: string,
  fileName: string,
  targetLevel: string,
): Promise<string> {
  const prompt = buildAnalysisPrompt(fileName, targetLevel);
  const partialNote = extracted.length < 80
    ? "\n\nNote : le texte extrait est partiel (PDF scanne ou mise en page complexe). Analyse ce qui est disponible."
    : "";

  let lastError: AIError | null = null;

  for (const limit of PDF_TEXT_LIMITS) {
    const slice = extracted.slice(0, limit);
    if (!slice) continue;

    try {
      const data = await callAI({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Tu analyses des supports pedagogiques FLE. Reponds uniquement en JSON valide, sans markdown.",
          },
          {
            role: "user",
            content: `${prompt}${partialNote}\n\nTEXTE EXTRAIT DU PDF:\n${slice}`,
          },
        ],
      });
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text) return text;
    } catch (err) {
      if (err instanceof AIError) {
        lastError = err;
        // Retry with a shorter excerpt when the gateway rejects the payload size.
        if (err.status === 413 || err.status === 400) continue;
        throw err;
      }
      throw err;
    }
  }

  if (lastError) throw lastError;
  throw new AIError(
    "L'IA n'a pas renvoye d'analyse exploitable pour ce PDF.",
    422,
  );
}

async function analyzePdfContent(
  pdfBase64: string,
  fileName: string,
  targetLevel: string,
): Promise<string> {
  let extracted = "";
  try {
    extracted = await extractPdfText(pdfBase64);
  } catch (err) {
    console.warn("PDF text extraction failed:", err);
  }

  if (!extracted) {
    throw new AIError(
      "Ce PDF ne contient pas de texte extractible (document scanne ou image). Utilisez un PDF avec du texte selectionnable.",
      422,
    );
  }

  return await analyzeExtractedText(extracted, fileName, targetLevel);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  let triggeredBy: string | null = null;

  try {
    triggeredBy = await getUserIdFromAuth(req);
    const secretBlock = await ensurePseudonymSecretOrLog("analyze-pdf-support", corsHeaders, null);
    if (secretBlock) return secretBlock;

    const { pdfBase64, fileName, targetLevel } = await req.json();
    if (!pdfBase64 || typeof pdfBase64 !== "string") {
      return json(400, { error: "Le fichier PDF est requis." });
    }
    if (pdfBase64.length > 16_000_000) {
      return json(413, { error: "Le PDF est trop volumineux. Limite : 10 Mo." });
    }

    const rawAnalysis = await analyzePdfContent(pdfBase64, fileName, targetLevel);
    const cleaned = rawAnalysis.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();

    await logAICall({
      function_name: "analyze-pdf-support",
      triggered_by_user_id: triggeredBy,
      status: "ok",
      data_categories: [],
      pseudonymization_level: "none",
      duration_ms: Date.now() - startedAt,
    });

    return json(200, { analysis: JSON.parse(cleaned) });
  } catch (error) {
    console.error("analyze-pdf-support error:", error);

    await logAICall({
      function_name: "analyze-pdf-support",
      triggered_by_user_id: triggeredBy,
      status: "error",
      data_categories: [],
      pseudonymization_level: "none",
      duration_ms: Date.now() - startedAt,
    });

    if (error instanceof AIError) {
      if (error.detail) {
        console.error("analyze-pdf-support AI provider detail:", error.detail.slice(0, 1000));
      }
      const status = error.status >= 500 ? 502 : (error.status === 401 || error.status === 403 ? 422 : error.status);
      return json(status, { error: error.message });
    }

    return json(500, { error: error instanceof Error ? error.message : "Erreur inconnue" });
  }
});
