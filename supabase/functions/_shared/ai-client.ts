/**
 * Shared AI client — uses Lovable AI Gateway only.
 * All edge functions should use `callAI()` instead of direct fetch.
 */

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface OpenAIToolChoice {
  type: "function";
  function: { name: string };
}

interface AICallOptions {
  model?: string;
  messages: { role: string; content: string }[];
  tools?: OpenAITool[];
  tool_choice?: OpenAIToolChoice;
}

/**
 * Call AI via Lovable AI Gateway.
 * Returns an OpenAI-compatible response object.
 */
export async function callAI(options: AICallOptions): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new AIError("LOVABLE_API_KEY non configurée.", 500);
  }

  const response = await fetch(LOVABLE_GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model || "google/gemini-2.5-flash",
      messages: options.messages,
      ...(options.tools ? { tools: options.tools } : {}),
      ...(options.tool_choice ? { tool_choice: options.tool_choice } : {}),
    }),
  });

  if (response.ok) {
    return await response.json();
  }

  if (response.status === 429) {
    throw new AIError("Trop de requêtes, réessayez dans quelques instants.", 429);
  }
  if (response.status === 402) {
    throw new AIError("Crédits IA insuffisants. Rechargez vos crédits dans Paramètres > Workspace > Usage.", 402);
  }

  const errText = await response.text();
  console.error("Lovable AI gateway error:", response.status, errText);
  throw new AIError(`Erreur du service IA (${response.status})`, response.status);
}

export class AIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
