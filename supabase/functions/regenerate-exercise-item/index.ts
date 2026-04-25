import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ItemPayload {
  question?: string;
  options?: string[];
  bonne_reponse?: string;
  explication?: string;
  texte_support?: string;
  script_audio?: string;
}

interface RequestPayload {
  competence: string;        // CO | CE | EE | EO | Structures
  format: string;            // qcm | vrai_faux | texte_lacunaire | ...
  niveau: string;            // A1 | A2 | B1 ...
  consigne?: string;
  current_item: ItemPayload;
  current_support?: { texte_support?: string; script_audio?: string };
  reason?: string;           // optional comment from learner
}

const SYSTEM = `Tu es un expert FLE/TCF IRN. Tu régénères UNE question équivalente à une question défectueuse.
Règles strictes :
- Même compétence, même format, même niveau CECRL.
- Question DIFFÉRENTE de l'originale (autre formulation, autre contexte IRN si possible).
- Pour qcm : EXACTEMENT 4 options ; pour vrai_faux : ["vrai","faux"] ; pour texte_lacunaire : pas d'options.
- bonne_reponse DOIT figurer EXACTEMENT dans options (sauf texte_lacunaire).
- Pour CO : conserve / propose un script_audio court (30-60 mots) si pertinent.
- Pour CE : conserve / propose un texte_support court (40-100 mots) si pertinent.
- Réponse via tool call uniquement.`;

async function callAI(payload: RequestPayload, attempt: number): Promise<ItemPayload | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

  const userPrompt = `COMPÉTENCE : ${payload.competence}
FORMAT : ${payload.format}
NIVEAU : ${payload.niveau}
CONSIGNE EXERCICE : ${payload.consigne || "(aucune)"}
SUPPORT EXISTANT (à réutiliser ou adapter) :
- script_audio : ${payload.current_support?.script_audio || payload.current_item.script_audio || "(aucun)"}
- texte_support : ${payload.current_support?.texte_support || payload.current_item.texte_support || "(aucun)"}

QUESTION DÉFECTUEUSE (à remplacer, NE PAS RECOPIER) :
- question : ${payload.current_item.question || "?"}
- options : ${JSON.stringify(payload.current_item.options || [])}
- bonne_reponse : ${payload.current_item.bonne_reponse || "?"}
- raison signalée : ${payload.reason || "(non précisée)"}

Tentative n°${attempt}. Génère une nouvelle question équivalente, claire et sans ambiguïté.`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userPrompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "regenerate_item",
          description: "Renvoie une question équivalente corrigée",
          parameters: {
            type: "object",
            properties: {
              question: { type: "string" },
              options: { type: "array", items: { type: "string" } },
              bonne_reponse: { type: "string" },
              explication: { type: "string" },
              script_audio: { type: "string" },
              texte_support: { type: "string" },
            },
            required: ["question", "options", "bonne_reponse", "explication"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "regenerate_item" } },
    }),
  });

  if (resp.status === 429) throw new Error("Rate limit (429)");
  if (resp.status === 402) throw new Error("Crédits IA épuisés (402)");
  if (!resp.ok) throw new Error(`Gateway error ${resp.status}`);

  const data = await resp.json();
  const tc = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc) return null;

  try {
    const item = JSON.parse(tc.function.arguments) as ItemPayload;
    return validateItem(item, payload) ? item : null;
  } catch {
    return null;
  }
}

function validateItem(item: ItemPayload, payload: RequestPayload): boolean {
  if (!item.question || item.question.trim().length < 3) return false;
  if (!item.bonne_reponse || item.bonne_reponse.trim().length === 0) return false;

  const fmt = payload.format;
  if (fmt === "qcm") {
    if (!Array.isArray(item.options) || item.options.length !== 4) return false;
    if (!item.options.map((o) => o.trim().toLowerCase()).includes(item.bonne_reponse.trim().toLowerCase())) return false;
  } else if (fmt === "vrai_faux") {
    const norm = item.bonne_reponse.trim().toLowerCase();
    if (!["vrai", "faux"].includes(norm)) return false;
    item.options = ["vrai", "faux"];
  } else if (fmt === "texte_lacunaire") {
    item.options = [];
  } else {
    if (Array.isArray(item.options) && item.options.length > 0) {
      if (!item.options.map((o) => o.trim().toLowerCase()).includes(item.bonne_reponse.trim().toLowerCase())) return false;
    }
  }

  // identical question to old one?
  if (item.question.trim().toLowerCase() === (payload.current_item.question || "").trim().toLowerCase()) return false;
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const payload = (await req.json()) as RequestPayload;
    if (!payload?.competence || !payload?.format || !payload?.current_item) {
      return new Response(JSON.stringify({ error: "Paramètres manquants" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let item = await callAI(payload, 1);
    if (!item) item = await callAI(payload, 2);

    if (!item) {
      return new Response(JSON.stringify({ error: "Régénération impossible après 2 tentatives" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ item }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("regenerate-exercise-item error:", e);
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    const status = msg.includes("429") ? 429 : msg.includes("402") ? 402 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
