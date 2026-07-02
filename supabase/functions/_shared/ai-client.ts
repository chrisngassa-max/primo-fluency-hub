const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

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
 * Routing priority:
 * 1. Lovable gateway when LOVABLE_API_KEY is set (preferred).
 * 2. Gemini direct when only GEMINI_API_KEY is set (maps `google/gemini-2.5-flash` → `gemini-2.5-flash`).
 * 3. Gemini fallback on transient Lovable errors when AI_GEMINI_FALLBACK=true and GEMINI_API_KEY is set.
 */
const GEMINI_FALLBACK_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

function geminiFallbackEnabled(): boolean {
  return Deno.env.get("AI_GEMINI_FALLBACK") === "true" && !!Deno.env.get("GEMINI_API_KEY");
}

function aiAuthErrorMessage(provider: "lovable" | "gemini", status: number): string {
  if (status === 403 || status === 401) {
    return provider === "lovable"
      ? "Le service IA (passerelle Lovable) refuse la requete. Verifiez LOVABLE_API_KEY cote serveur."
      : "Le service IA (Gemini) refuse la requete. Verifiez GEMINI_API_KEY et l'activation de l'API Generative Language.";
  }
  return `Erreur du service IA (${status})`;
}

/**
 * Call AI via Lovable AI Gateway when configured, otherwise Gemini direct when GEMINI_API_KEY is set.
 * Returns an OpenAI-compatible response object.
 */
export async function callAI(options: AICallOptions): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

  if (LOVABLE_API_KEY) {
    const response = await fetch(LOVABLE_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: normalizeLovableModel(options.model || "google/gemini-2.5-flash"),
        messages: options.messages,
        ...(options.tools ? { tools: options.tools } : {}),
        ...(options.tool_choice ? { tool_choice: options.tool_choice } : {}),
      }),
    });

    if (response.ok) {
      return await response.json();
    }

    const errText = await response.text();
    console.error("Lovable AI gateway error:", response.status, errText);

    if (!GEMINI_FALLBACK_STATUSES.has(response.status) || !geminiFallbackEnabled()) {
      const message = GEMINI_FALLBACK_STATUSES.has(response.status) && !geminiFallbackEnabled()
        ? `Le service IA (passerelle Lovable) est temporairement indisponible (${response.status}). Reessayez dans quelques instants.`
        : aiAuthErrorMessage("lovable", response.status);
      throw new AIError(message, response.status >= 500 ? 502 : response.status, errText);
    }

    console.warn("Lovable AI gateway unavailable, falling back to Gemini:", response.status);
    return await callGemini(options);
  }

  if (GEMINI_API_KEY) {
    console.log("LOVABLE_API_KEY absent, using Gemini as primary provider");
    return await callGemini(options);
  }

  throw new AIError(
    "Aucun service IA configure. Definissez LOVABLE_API_KEY ou GEMINI_API_KEY cote serveur.",
    500,
  );
}

async function callGemini(options: AICallOptions): Promise<any> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) {
    throw new AIError("GEMINI_API_KEY non configuree.", 500);
  }

  const systemParts: { text: string }[] = [];
  const contents: Array<{ role: "user" | "model"; parts: { text: string }[] }> = [];

  for (const message of options.messages) {
    if (message.role === "system") {
      systemParts.push({ text: message.content });
      continue;
    }

    contents.push({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    });
  }

  const functionDeclarations = options.tools?.map((tool) => ({
    name: tool.function.name,
    description: tool.function.description,
    parameters: sanitizeGeminiSchema(tool.function.parameters),
  }));

  const body = {
    contents,
    ...(systemParts.length ? { systemInstruction: { parts: systemParts } } : {}),
    ...(functionDeclarations?.length ? { tools: [{ functionDeclarations }] } : {}),
    ...(options.tool_choice
      ? {
          toolConfig: {
            functionCallingConfig: {
              mode: "ANY",
              allowedFunctionNames: [options.tool_choice.function.name],
            },
          },
        }
      : {}),
  };

  const model = normalizeGeminiModel(options.model || "google/gemini-2.5-flash");
  const response = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Gemini API error:", response.status, errText);
    throw new AIError(aiAuthErrorMessage("gemini", response.status), response.status, errText);
  }

  return geminiToOpenAI(await response.json(), options);
}

/**
 * Certains identifiants de modèle (ex. `gemini-3-flash-preview`) sont des alias instables
 * que la passerelle Lovable rejette. On les ramène vers un modèle réellement supporté par
 * Lovable (`google/gemini-2.5-flash`) afin d'éviter un échec qui forcerait le secours Gemini.
 */
function normalizeLovableModel(model: string): string {
  const bare = model.replace(/^google\//, "");
  if (/gemini-3/.test(bare) || /preview/.test(bare)) {
    return "google/gemini-2.5-flash";
  }
  return model;
}

/**
 * Certains identifiants de modèle (ex. `gemini-3-flash-preview`) sont des alias propres
 * à la passerelle Lovable et n'existent pas sur l'API Gemini directe. Quand on bascule
 * en secours sur Gemini, on les ramène vers un modèle stable réellement disponible afin
 * d'éviter une erreur 404 « model not found ».
 */
function normalizeGeminiModel(model: string): string {
  const bare = model.replace(/^google\//, "");
  if (/gemini-3/.test(bare) || /preview/.test(bare)) {
    return "gemini-2.5-flash";
  }
  return bare;
}

/**
 * L'API Gemini (generateContent) n'accepte qu'un sous-ensemble d'OpenAPI pour les
 * `functionDeclarations.parameters`. Des mots-clés JSON-Schema courants comme
 * `additionalProperties`, `minimum`, `maximum`, `$schema`... provoquent une erreur 400
 * « Invalid JSON payload ... Unknown name ... ». On nettoie donc récursivement le schéma
 * pour ne conserver que les champs supportés avant l'appel direct à Gemini.
 */
const GEMINI_SCHEMA_ALLOWED_KEYS = new Set([
  "type",
  "format",
  "description",
  "nullable",
  "enum",
  "items",
  "properties",
  "required",
  "anyOf",
  "minItems",
  "maxItems",
]);

function sanitizeGeminiSchema(schema: unknown): any {
  if (Array.isArray(schema)) {
    return schema.map((entry) => sanitizeGeminiSchema(entry));
  }
  if (!schema || typeof schema !== "object") {
    return schema;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
    if (!GEMINI_SCHEMA_ALLOWED_KEYS.has(key)) continue;

    if (key === "properties" && value && typeof value === "object") {
      const cleanedProps: Record<string, unknown> = {};
      for (const [propName, propSchema] of Object.entries(value as Record<string, unknown>)) {
        cleanedProps[propName] = sanitizeGeminiSchema(propSchema);
      }
      result[key] = cleanedProps;
    } else if (key === "items" || key === "anyOf") {
      result[key] = sanitizeGeminiSchema(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function geminiToOpenAI(data: any, options: AICallOptions): any {
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .filter((part: any) => typeof part.text === "string")
    .map((part: any) => part.text)
    .join("\n");

  const functionCall = parts.find((part: any) => part.functionCall)?.functionCall;
  const toolCalls = functionCall
    ? [toToolCall(functionCall.name, functionCall.args ?? {})]
    : maybeToolCallFromJsonText(text, options);

  return {
    choices: [{
      message: {
        role: "assistant",
        content: text || null,
        ...(toolCalls?.length ? { tool_calls: toolCalls } : {}),
      },
      finish_reason: toolCalls?.length ? "tool_calls" : "stop",
      index: 0,
    }],
  };
}

function toToolCall(name: string, args: unknown) {
  return {
    id: `call_${crypto.randomUUID().replaceAll("-", "")}`,
    type: "function",
    function: {
      name,
      arguments: JSON.stringify(args ?? {}),
    },
  };
}

function maybeToolCallFromJsonText(text: string, options: AICallOptions) {
  if (!text || !options.tool_choice) return undefined;

  try {
    const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    return [toToolCall(options.tool_choice.function.name, parsed)];
  } catch {
    return undefined;
  }
}

export class AIError extends Error {
  status: number;
  detail?: string;
  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}
