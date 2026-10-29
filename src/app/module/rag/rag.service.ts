/* eslint-disable @typescript-eslint/no-explicit-any */
import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { EmbeddingService } from "./embedding.service";
import { IndexingService } from "./indexing.service";
import { LLMService } from "./llm.service";

const SHOP_ASSISTANT_PROMPT = [
  "You are the friendly shopping assistant of Shoe Mart, an online store in Bangladesh.",
  "Answer only from the store information in the context. Never invent products, prices or policies.",
  "Reply in the customer's language: Bangla if they write in Bangla (or Banglish), otherwise English.",
  "Prices are in Bangladeshi Taka (৳).",
  "When suggesting products, list each with its name, price and its link exactly as given (e.g. /products/...).",
  "Keep answers short and clear. Use plain text only: no markdown, no ** or #.",
  "If the context does not have the answer, say so politely and suggest contacting the store by phone or WhatsApp, giving the number if it is in the context.",
].join(" ");

export class RAGService {
  private embeddingService: EmbeddingService;
  private llmService: LLMService;
  private indexingService: IndexingService;

  constructor() {
    this.embeddingService = new EmbeddingService();
    this.indexingService = new IndexingService();
    this.llmService = new LLMService();
  }

  async ingestData() {
    return this.indexingService.indexShoeMartData();
  }

  async retrieveRelevantDocuments(
    query: string,
    limit: number = 5,
    sourceType?: string,
  ) {
    let queryEmbedding: number[];
    try {
      queryEmbedding = await this.embeddingService.generateEmbedding(query, 3);
    } catch (error) {
      // Embedding service busy or down: fall back to a plain word search so
      // the customer still gets an answer
      console.warn("RAG: embedding failed, using keyword search:", (error as Error).message);
      return this.keywordSearch(query, limit, sourceType);
    }

    try {
      const vectorLiteral = `[${queryEmbedding.join(",")}]`;

      const results = await prisma.$queryRaw(Prisma.sql`
          SELECT id, "chunkKey", "sourceType", "sourceId", "sourceLabel", content, metadata, 1 - (embedding <=> CAST(${vectorLiteral} AS vector(2048))) as similarity
          FROM "document_embeddings"
          WHERE "isDeleted" = false
          ${sourceType ? Prisma.sql`AND "sourceType" = ${sourceType}` : Prisma.empty}
          ORDER BY embedding <=> CAST(${vectorLiteral} AS vector(2048))
          Limit ${limit}
          `);

      return results;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  private async keywordSearch(query: string, limit: number, sourceType?: string) {
    const words = query
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 2)
      .slice(0, 8);
    if (words.length === 0) return [];
    const matches = Prisma.join(
      words.map((w) => Prisma.sql`(CASE WHEN content ILIKE ${"%" + w + "%"} THEN 1 ELSE 0 END)`),
      " + ",
    );
    return prisma.$queryRaw(Prisma.sql`
      SELECT id, "chunkKey", "sourceType", "sourceId", "sourceLabel", content, metadata, 0 as similarity
      FROM "document_embeddings"
      WHERE "isDeleted" = false
      ${sourceType ? Prisma.sql`AND "sourceType" = ${sourceType}` : Prisma.empty}
      ORDER BY (${matches}) DESC, "updatedAt" DESC
      LIMIT ${limit}
    `);
  }

  async generateAnswer(
    query: string,
    limit: number = 5,
    sourceType?: string,
    asJson: boolean = false,
  ) {
    try {
      const relevantDocs = await this.retrieveRelevantDocuments(
        query,
        limit,
        sourceType,
      );

      // Contact, delivery and payment details go with every question, since
      // customers ask about them in many different ways
      const storeInfo = await prisma.$queryRaw<{ content: string }[]>(Prisma.sql`
        SELECT content FROM "document_embeddings"
        WHERE "chunkKey" = 'store-info' AND "isDeleted" = false
      `);
      const context = [
        ...storeInfo.map((d) => d.content),
        ...(relevantDocs as any)
          .filter((doc: any) => doc.content && doc.chunkKey !== "store-info")
          .map((doc: any) => doc.content),
      ];

      let answer: any;
      try {
        const ask = () =>
          this.llmService.generateResponse(
            query,
            context,
            asJson,
            asJson ? undefined : SHOP_ASSISTANT_PROMPT,
          );
        answer = await ask();
        // "Thinking" models sometimes use their whole budget and reply with
        // nothing; ask once more, then fall back to the polite message below
        if (!asJson && !String(answer ?? "").trim()) answer = await ask();
        if (!asJson && !String(answer ?? "").trim()) {
          throw new Error("Empty answer from the AI model");
        }
      } catch (error) {
        if (asJson) throw error;
        // AI busy (rate limit) or down: a polite reply instead of an error
        console.warn("RAG: answer generation failed:", (error as Error).message);
        const phone = /Phone: (.+)/.exec(storeInfo[0]?.content ?? "")?.[1];
        const whatsapp = /WhatsApp: (.+)/.exec(storeInfo[0]?.content ?? "")?.[1];
        const contact = [phone && `call ${phone}`, whatsapp && `WhatsApp ${whatsapp}`]
          .filter(Boolean)
          .join(" or ");
        answer = `Sorry, I'm getting a lot of questions right now. Please ask again in a minute${
          contact ? `, or ${contact}` : ""
        }.`;
      }

      // Simple cleanup for JSON responses if needed
      if (asJson && typeof answer === 'string') {
        answer = answer.replace(/```json\n?/, "").replace(/```$/, "").trim();
        try {
          answer = JSON.parse(answer);
        } catch (e) {
          console.error("JSON Parse failed, returning raw string");
        }
      }

      return {
        answer,
        sources: (relevantDocs as any).map((doc: any) => ({
          id: doc.id,
          sourceType: doc.sourceType,
          sourceLabel: doc.sourceLabel,
          similarity: doc.similarity,
        })),
        contextUsed: context.length > 0,
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async getStats() {
    const totalDocuments: any = await prisma.$queryRaw(Prisma.sql`
        SELECT COUNT(*) as count FROM "document_embeddings" WHERE "isDeleted" = false;
    `);

    return {
      totalActiveDocuments: Number(totalDocuments[0]?.count ?? 0),
      timestamp: new Date(),
    };
  }
}
