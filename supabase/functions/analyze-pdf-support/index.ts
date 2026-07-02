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

/** Fallback for scanned PDFs: Gemini multimodal with inline PDF bytes. */
async function analyzeWithGeminiPdf(pdfBase64: string, prompt: string): Promise<string> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new AIError("GEMINI_API_KEY non configuree.", 500);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
          ],
        }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      }),
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("Gemini PDF multimodal error:", response.status, errText);
    throw new AIError(
      response.status === 403
        ? "Le service IA refuse l'analyse directe du PDF. Verifiez la configuration serveur."
        : "Impossible d'analyser ce PDF.",
      response.status >= 500 ? 502 : 422,
      errText,
    );
  }

  const payload = await response.json();
  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text || "")
    .join("")
    .trim();
  if (!text) throw new AIError("Aucun contenu exploitable detecte dans le PDF.", 422);
  return text;
}

async function analyzePdfContent(
  pdfBase64: string,
  fileName: string,
  targetLevel: string,
): Promise<string> {
  const prompt = buildAnalysisPrompt(fileName, targetLevel);

  let extracted = "";
  try {
    extracted = await extractPdfText(pdfBase64);
  } catch (err) {
    console.warn("PDF text extraction failed:", err);
  }

  if (extracted.length >= 80) {
    const data = await callAI({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: "Tu analyses des supports pedagogiques FLE. Reponds uniquement en JSON valide, sans markdown.",
        },
        {
          role: "user",
          content: `${prompt}\n\nTEXTE EXTRAIT DU PDF:\n${extracted.slice(0, 120_000)}`,
        },
      ],
    });
    const text = data.choices?.[0]?.message?.content?.trim();
    if (text) return text;
  }

  console.warn(
    extracted.length > 0
      ? "Extracted PDF text too short, trying multimodal Gemini"
      : "No extractable PDF text, trying multimodal Gemini",
  );
  return await analyzeWithGeminiPdf(pdfBase64, prompt);
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
      return json(error.status >= 500 ? 502 : error.status, { error: error.message });
    }

    return json(500, { error: error instanceof Error ? error.message : "Erreur inconnue" });
  }
});
