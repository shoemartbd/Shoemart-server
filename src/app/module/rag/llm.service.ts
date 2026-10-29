/* eslint-disable @typescript-eslint/no-explicit-any */
import status from "http-status";
import { envVars } from "../../config/env";
import AppError from "../../errorHelpers/AppError";

/**
 * Pull the first valid JSON value out of an LLM reply. Models (reasoning ones
 * especially) often wrap the JSON in prose such as "The user wants ..." or in
 * ```json fences, so JSON.parse on the raw text fails. This walks each "{" / "["
 * in order, finds its balanced closing bracket (ignoring brackets inside
 * strings), and returns the first slice that parses and passes `isValid`.
 */
export const extractJson = <T = any>(
  text: string,
  isValid: (value: any) => boolean = () => true,
): T | null => {
  if (!text) return null;
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();

  try {
    const whole = JSON.parse(cleaned);
    if (isValid(whole)) return whole;
  } catch {
    // fall through to scanning
  }

  for (let start = 0; start < cleaned.length; start++) {
    const open = cleaned[start];
    if (open !== "{" && open !== "[") continue;
    const close = open === "{" ? "}" : "]";

    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === open) depth++;
      else if (ch === close && --depth === 0) {
        try {
          const value = JSON.parse(cleaned.slice(start, i + 1));
          if (isValid(value)) return value;
        } catch {
          // not JSON; try the next opening bracket
        }
        break;
      }
    }
  }
  return null;
};

export class LLMService {
  private apiKey: string;
  private apiUrl: string = "https://openrouter.ai/api/v1";
  private model: string;
  private fallbackModels: string[];

  constructor() {
    this.apiKey = envVars.RAG.OPENROUTER_API_KEY || "";
    this.model =
      envVars.RAG.OPENROUTER_LLM_MODEL ||
      "google/gemini-2.0-flash-001";
    this.fallbackModels = (envVars.RAG.OPENROUTER_LLM_FALLBACK_MODELS ?? [])
      .filter((m) => m !== this.model)
      .slice(0, 2); // OpenRouter accepts up to 3 models in total

    if (!this.apiKey) {
      throw new Error("OpenRouter API key is missing...");
    }
  }

  async generateResponse(
    prompt: string,
    context: string[] = [],
    asJson: boolean = false,
    // Replaces the default instructions (used by the storefront chatbot)
    systemOverride?: string,
  ) {
    try {
      let fullPrompt =
        context.length > 0
          ? `Context information:\n${context.join("\n\n")}\n\nQuestion: ${prompt}\n\nAnswer based on the context above.`
          : prompt;

      if (asJson) {
        fullPrompt += `\n\nReturn ONLY a valid JSON object. Do not include any markdown formatting like \`\`\`json.`;
      }

      const systemMessage = systemOverride
        ? systemOverride
        : asJson
        ? "You are a helpful assistant for Shoe Mart, an e-commerce platform. Answer questions based on the provided context. You MUST respond with ONLY valid JSON format. Do not include markdown tags."
        : "You are a helpful assistant for Shoe Mart, an e-commerce platform. Answer questions based on the provided context. If the context does not contain the answer, say you don't have enough information.";

      const bodyPayload: any = {
        model: this.model,
        // OpenRouter moves on to these when the main model errors or is busy
        ...(this.fallbackModels.length > 0 && {
          models: [this.model, ...this.fallbackModels],
        }),
        messages: [
          {
            role: "system",
            content: systemMessage,
          },
          {
            role: "user",
            content: fullPrompt,
          },
        ],
        temperature: 0.1,
        max_tokens: asJson ? 4000 : 1500,
        // Reasoning models: think briefly and keep the thinking out of the
        // reply, so it doesn't leak in front of the JSON. Others ignore this.
        reasoning: { effort: "low", exclude: true },
      };

      const send = () =>
        fetch(`${this.apiUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://shoemart.com",
            "X-Title": "Shoe Mart RAG System",
          },
          body: JSON.stringify(bodyPayload),
        });

      // Free models are often busy: 429 (rate limit) or "provider
      // overloaded". OpenRouter may report that with HTTP 200 and an `error`
      // in the body instead of `choices`, so check both. Retry a couple of
      // times with a short wait, keeping the customer's wait reasonable.
      const RETRY_WAITS_MS = [2000, 4000];
      for (let attempt = 0; ; attempt++) {
        const response = await send();
        const data: any = await response.json().catch(() => ({}));
        const apiError = !response.ok || data?.error ? data?.error : null;

        if (response.ok && !apiError) {
          return data.choices?.[0]?.message?.content ?? "";
        }

        const code = Number(apiError?.code ?? response.status);
        const retryable = code === 429 || code === 408 || code >= 500;
        if (!retryable || attempt >= RETRY_WAITS_MS.length) {
          throw new Error(
            `OpenRouter API error: ${code} - ${apiError?.message || "unknown error"}`,
          );
        }

        const retryAfter = Number(response.headers.get("retry-after"));
        const wait =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1000, 8000)
            : RETRY_WAITS_MS[attempt];
        console.warn(
          `OpenRouter busy (${code} ${apiError?.message ?? ""}); retrying in ${wait}ms`,
        );
        await new Promise((r) => setTimeout(r, wait));
      }
    } catch (error) {
      console.error("Error generating LLM response:", error);
      throw error;
    }
  }

  /**
   * Ask for JSON and return it parsed. Retries once when the reply has no
   * usable JSON, then fails with a readable error instead of a raw
   * "Unexpected token" SyntaxError.
   */
  async generateJson<T = any>(
    prompt: string,
    isValid: (value: any) => boolean = () => true,
    attempts = 2,
  ): Promise<T> {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const reply = await this.generateResponse(prompt, [], true);
      const parsed = extractJson<T>(reply, isValid);
      if (parsed !== null) return parsed;
      console.warn(
        `LLM reply had no valid JSON (attempt ${attempt}/${attempts}):`,
        String(reply).slice(0, 300),
      );
    }
    throw new AppError(
      status.BAD_GATEWAY,
      "The AI returned an unexpected response. Please try again.",
    );
  }
}
