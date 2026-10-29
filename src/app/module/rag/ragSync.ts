import { IndexingService } from "./indexing.service";

let indexer: IndexingService | null = null;

// Refresh one product's chatbot entry in the background. Never throws: a
// product save must not fail because the AI service is down or not set up.
export const queueProductIndexSync = (productId?: string | null) => {
  if (!productId) return;
  try {
    indexer ??= new IndexingService();
  } catch {
    return; // OpenRouter key not configured
  }
  void indexer.syncProduct(productId).catch((error) =>
    console.error(`RAG: product ${productId} not re-indexed:`, (error as Error).message),
  );
};
