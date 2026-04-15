/**
 * Shared AI client — tries Lovable gateway first, falls back to Anthropic on 402.
 * All edge functions should use `callAI()` instead of direct fetch.
 */

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
const ANTHROPIC_VERSION = "2023-06-01";

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

/** Convert OpenAI tool format to Anthropic tool format */
function toAnthropicTools(tools: OpenAITool[]) {
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));
}

/** Convert Anthropic response to OpenAI-compatible response */
function anthropicToOpenAI(anthropicResp: any) {
  const toolUseBlock = anthropicResp.content?.find((b: any) => b.type === "tool_use");
  const textBlock = anthropicResp.content?.find((b: any) => b.type === "text");

  if (toolUseBlock) {
    return {
      choices: [{
        message: {
          role: "assistant",
          content: null,
          tool_calls: [{
            id: toolUseBlock.id,
            type: "function",
            function: {
              name: toolUseBlock.name,
              arguments: JSON.stringify(toolUseBlock.input),
            },
          }],
        },
      }],
    };
  }

  return {
    choices: [{
      message: {
        role: "assistant",
        content: textBlock?.text || "",
      },
    }],
  };
}

/**
 * Call AI — tries Lovable gateway first; on 402 (no credits) falls back to Anthropic.
 * Returns an OpenAI-compatible response object.
 */
export async function callAI(options: AICallOptions): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

  // Try Lovable gateway first
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

    if (response.status === 429) {
      throw new AIError("Trop de requêtes, réessayez dans quelques instants.", 429);
    }

    // On 402 (no credits), fall through to Anthropic
    if (response.status !== 402) {
      const errText = await response.text();
      console.error("Lovable gateway error:", response.status, errText);
      // Still try Anthropic as fallback
    } else {
      console.log("Lovable credits exhausted, falling back to Anthropic");
    }
  }

  // Fallback: Anthropic
  if (!ANTHROPIC_API_KEY) {
    throw new AIError("Crédits IA insuffisants et aucune clé Anthropic configurée.", 402);
  }

  const systemMsg = options.messages.find((m) => m.role === "system");
  const userMessages = options.messages.filter((m) => m.role !== "system");

  const body: Record<string, unknown> = {
    model: ANTHROPIC_MODEL,
    max_tokens: 8192,
    messages: userMessages.map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content })),
  };

  if (systemMsg) {
    body.system = systemMsg.content;
  }

  if (options.tools && options.tools.length > 0) {
    body.tools = toAnthropicTools(options.tools);
    if (options.tool_choice) {
      body.tool_choice = { type: "tool", name: options.tool_choice.function.name };
    }
  }

  const response = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Anthropic API error:", response.status, errText);
    if (response.status === 429) {
      throw new AIError("Trop de requêtes, réessayez dans quelques instants.", 429);
    }
    throw new AIError(`Erreur du service IA (Anthropic: ${response.status})`, response.status);
  }

  const anthropicData = await response.json();
  return anthropicToOpenAI(anthropicData);
}

export class AIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
