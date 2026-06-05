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
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

  // --- Primary: Lovable AI Gateway ---
  if (LOVABLE_API_KEY) {
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

    if (response.ok) return await response.json();

    if (response.status === 429) {
      throw new AIError("Trop de requêtes, réessayez dans quelques instants.", 429);
    }
    if (response.status === 402) {
      throw new AIError("Crédits IA insuffisants. Rechargez vos crédits dans Paramètres > Workspace > Usage.", 402);
    }

    const errText = await response.text();
    console.error("Lovable AI gateway error:", response.status, errText);

    // Fallback to direct Gemini if gateway fails (e.g. 404 when key not registered on external project)
    if (!GEMINI_API_KEY) {
      throw new AIError(`Erreur du service IA (${response.status})`, response.status);
    }
    console.warn("Falling back to direct Gemini API.");
  }

  // --- Fallback: Direct Gemini API ---
  if (!GEMINI_API_KEY) {
    throw new AIError("Aucune clé IA configurée (LOVABLE_API_KEY ou GEMINI_API_KEY).", 500);
  }

  const geminiModel = (options.model || "google/gemini-2.5-flash").replace(/^google\//, "");
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${GEMINI_API_KEY}`;

  const systemText = options.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = options.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const geminiBody: any = { contents };
  if (systemText) geminiBody.systemInstruction = { parts: [{ text: systemText }] };

  if (options.tools && options.tools.length > 0) {
    geminiBody.tools = [{
      functionDeclarations: options.tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      })),
    }];
    if (options.tool_choice) {
      geminiBody.toolConfig = {
        functionCallingConfig: {
          mode: "ANY",
          allowedFunctionNames: [options.tool_choice.function.name],
        },
      };
    }
  }

  const geminiResp = await fetch(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(geminiBody),
  });

  if (!geminiResp.ok) {
    const errText = await geminiResp.text();
    console.error("Gemini direct error:", geminiResp.status, errText);
    if (geminiResp.status === 429) throw new AIError("Trop de requêtes, réessayez plus tard.", 429);
    throw new AIError(`Erreur du service IA (${geminiResp.status})`, geminiResp.status);
  }

  const geminiData = await geminiResp.json();
  const candidate = geminiData.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  const textPart = parts.find((p: any) => p.text)?.text || "";
  const funcCall = parts.find((p: any) => p.functionCall)?.functionCall;

  const message: any = { role: "assistant", content: textPart };
  if (funcCall) {
    message.tool_calls = [{
      id: `call_${Date.now()}`,
      type: "function",
      function: {
        name: funcCall.name,
        arguments: JSON.stringify(funcCall.args || {}),
      },
    }];
  }

  return {
    choices: [{ message, finish_reason: funcCall ? "tool_calls" : "stop" }],
  };
}

export class AIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
