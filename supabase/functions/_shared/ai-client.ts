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
 * Call AI via Lovable AI Gateway, then fall back to Gemini direct.
 * Returns an OpenAI-compatible response object.
 */
export async function callAI(options: AICallOptions): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

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

    if (response.ok) {
      return await response.json();
    }

    const errText = await response.text();
    console.error("Lovable AI gateway error, falling back to Gemini:", response.status, errText);
  } else {
    console.warn("LOVABLE_API_KEY is not configured, using Gemini fallback.");
  }

  return await callGemini(options);
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
    parameters: tool.function.parameters,
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
    throw new AIError(`Erreur du service IA (${response.status})`, response.status);
  }

  return geminiToOpenAI(await response.json(), options);
}

function normalizeGeminiModel(model: string): string {
  return model.replace(/^google\//, "");
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
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
