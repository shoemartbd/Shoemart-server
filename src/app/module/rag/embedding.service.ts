import { envVars } from "../../config/env";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class EmbeddingService {
  private apikey: string;
  private apiUrl: string = "https://openrouter.ai/api/v1";
  private embeddingModel: string;

  constructor() {
    this.apikey = envVars.RAG.OPENROUTER_API_KEY || "";
    this.embeddingModel =
      envVars.RAG.OPENROUTER_EMBEDDING_MODEL ||
      "nvidia/llama-nemotron-embed-vl-1b-v2:free";

    if (!this.apikey) {
      throw new Error("OPENROUTER_API_KEY is not set in .env");
    }
  }

  // Free models allow only a few requests per minute and answer 429 when
  // busy, so rate-limit and server errors are retried with growing waits
  async generateEmbedding(text: string, maxAttempts = 5): Promise<number[]> {
    for (let attempt = 1; ; attempt++) {
      const response = await fetch(`${this.apiUrl}/embeddings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apikey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: text,
          model: this.embeddingModel,
        }),
      });

      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt < maxAttempts) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const waitMs =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1000, 30_000)
            : Math.min(1000 * 2 ** attempt, 20_000);
        await sleep(waitMs);
        continue;
      }

      if (!response.ok) {
        throw new Error(`OpenRouter API Error: ${response.status}`);
      }

      const data = await response.json();
      if (!data.data || data.data.length == 0) {
        throw new Error("No embedding data returned");
      }
      return data.data[0].embedding;
    }
  }
}
