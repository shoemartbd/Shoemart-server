import { Prisma } from "../../../generated/prisma/client";
import { ProductStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { EmbeddingService } from "./embedding.service";

const toVectorLiteral = (vector: number[]) => `[${vector.join(",")}]`;

// Rich-text fields are stored as HTML; the AI only needs the words
const plainText = (html?: string | null, max = 1500) =>
  (html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const taka = (value: number) => `৳${Math.round(value).toLocaleString("en-US")}`;

// Long pages are split so each piece stays focused for search
const chunk = (text: string, size = 1200) => {
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += size) parts.push(text.slice(i, i + size));
  return parts.length ? parts : [""];
};

interface IndexDoc {
  chunkKey: string;
  sourceType: string;
  sourceId: string;
  sourceLabel: string;
  content: string;
  metadata?: Record<string, unknown>;
}

// Products the shop is selling (draft and deleted ones stay out)
const LIVE_PRODUCT = { status: { in: [ProductStatus.ACTIVE, ProductStatus.OUT_OF_STOCK] } };

const loadProducts = (where: Prisma.ProductWhereInput) =>
  prisma.product.findMany({
    where,
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      stock: true,
      sku: true,
      tags: true,
      sellPrice: true,
      regularPrice: true,
      shortDescription: true,
      description: true,
      category: { select: { name: true, parent: { select: { name: true } } } },
      brand: { select: { name: true } },
      variants: { select: { combination: true, sellPrice: true, quantity: true } },
      reviews: { select: { rating: true } },
    },
  });

type LoadedProduct = Awaited<ReturnType<typeof loadProducts>>[number];

export class IndexingService {
  private embeddingService: EmbeddingService;

  constructor() {
    this.embeddingService = new EmbeddingService();
  }

  async indexDocument(
    chunkKey: string,
    sourceType: string,
    sourceId: string,
    content: string,
    sourceLabel?: string,
    metadata?: Record<string, unknown>,
  ) {
    const embedding = await this.embeddingService.generateEmbedding(content);
    const vectorLiteral = toVectorLiteral(embedding);

    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "document_embeddings"
      ("id", "chunkKey", "sourceType", "sourceId", "sourceLabel", "content", "metadata", "embedding", "updatedAt")
      VALUES
      (
        gen_random_uuid(),
        ${chunkKey},
        ${sourceType},
        ${sourceId},
        ${sourceLabel || null},
        ${content},
        ${JSON.stringify(metadata || {})} :: jsonb,
        CAST(${vectorLiteral} AS vector(2048)),
        NOW()
      )
      ON CONFLICT ("chunkKey")
      DO UPDATE SET
        "sourceType" = EXCLUDED."sourceType",
        "sourceId" = EXCLUDED."sourceId",
        "sourceLabel" = EXCLUDED."sourceLabel",
        "content" = EXCLUDED."content",
        "metadata" = EXCLUDED."metadata",
        "embedding" = EXCLUDED."embedding",
        "isDeleted" = false,
        "deletedAt" = null,
        "updatedAt" = NOW()
    `);
  }

  // ── What the assistant knows ──────────────────────────────────────────

  private productDoc(product: LoadedProduct): IndexDoc {
    const category = product.category.parent
      ? `${product.category.parent.name} > ${product.category.name}`
      : product.category.name;
    const inStock = product.status === ProductStatus.ACTIVE && product.stock > 0;
    const variants = product.variants.length
      ? product.variants
          .map(
            (v) =>
              `${v.combination}: ${taka(v.sellPrice)}${v.quantity > 0 ? "" : " (out of stock)"}`,
          )
          .join("; ")
      : null;
    const ratings = product.reviews.map((r) => r.rating);
    const rating = ratings.length
      ? `${(ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)}/5 from ${ratings.length} reviews`
      : null;

    const content = [
      `Product: ${product.name}`,
      `Category: ${category}`,
      product.brand && `Brand: ${product.brand.name}`,
      `Price: ${taka(product.sellPrice)}${
        product.regularPrice > product.sellPrice ? ` (regular ${taka(product.regularPrice)})` : ""
      }`,
      variants && `Options: ${variants}`,
      `Availability: ${inStock ? "In stock" : "Out of stock"}`,
      product.sku && `Product code: ${product.sku}`,
      product.tags.length > 0 && `Tags: ${product.tags.join(", ")}`,
      rating && `Rating: ${rating}`,
      `Summary: ${plainText(product.shortDescription, 400)}`,
      `Details: ${plainText(product.description, 1200)}`,
      `Link: /products/${product.slug}`,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      chunkKey: `product-${product.id}`,
      sourceType: "PRODUCT",
      sourceId: product.id,
      sourceLabel: product.name,
      content,
      metadata: { productId: product.id, slug: product.slug, categoryName: product.category.name },
    };
  }

  private async buildAllDocs(): Promise<IndexDoc[]> {
    const [products, categories, site, shipping, payment, faqs, pages] = await Promise.all([
      loadProducts(LIVE_PRODUCT),
      prisma.category.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          parent: { select: { name: true } },
          subcategories: { where: { isActive: true }, select: { name: true } },
          _count: { select: { products: { where: LIVE_PRODUCT } } },
        },
      }),
      prisma.siteSetting.findUnique({ where: { id: "default" } }),
      prisma.shippingSetting.findUnique({ where: { id: "default" } }),
      prisma.paymentSetting.findUnique({ where: { id: "default" } }),
      prisma.faq.findMany({ where: { isActive: true }, orderBy: { order: "asc" } }),
      prisma.pageContent.findMany(),
    ]);

    const docs: IndexDoc[] = products.map((p) => this.productDoc(p));

    for (const c of categories) {
      docs.push({
        chunkKey: `category-${c.id}`,
        sourceType: "CATEGORY",
        sourceId: c.id,
        sourceLabel: c.name,
        content: [
          `Category: ${c.parent ? `${c.parent.name} > ${c.name}` : c.name}`,
          c.subcategories.length > 0 &&
            `Subcategories: ${c.subcategories.map((s) => s.name).join(", ")}`,
          `Products available: ${c._count.products}`,
          `Link: /products?categoryId=${c.id}`,
        ]
          .filter(Boolean)
          .join("\n"),
      });
    }

    // Contact, delivery and payment in one place: the most common questions
    const storeName = site?.siteName || "Shoe Mart";
    docs.push({
      chunkKey: "store-info",
      sourceType: "STORE",
      sourceId: "default",
      sourceLabel: `${storeName} store information`,
      content: [
        `Store: ${storeName}`,
        site?.description && `About: ${plainText(site.description, 600)}`,
        site?.phone && `Phone: ${site.phone}`,
        site?.whatsapp && `WhatsApp: ${site.whatsapp}`,
        site?.email && `Email: ${site.email}`,
        site?.address && `Address: ${site.address}`,
        site?.facebook && `Facebook: ${site.facebook}`,
        shipping &&
          `Delivery charge: Inside Dhaka ${taka(shipping.insideDhakaShippingFee)}, Outside Dhaka ${taka(shipping.outsideDhakaShippingFee)}`,
        `Payment methods: Cash on Delivery${payment?.bkashEnabled ? ", bKash" : ""}${
          payment?.sslcommerzEnabled ? ", card / mobile banking (SSLCommerz)" : ""
        }`,
        "Order tracking: use Track Order with the order number and phone number.",
      ]
        .filter(Boolean)
        .join("\n"),
    });

    for (const faq of faqs) {
      docs.push({
        chunkKey: `faq-${faq.id}`,
        sourceType: "FAQ",
        sourceId: faq.id,
        sourceLabel: faq.question,
        content: `Question: ${faq.question}\nAnswer: ${plainText(faq.answer, 1500)}`,
      });
    }

    for (const page of pages) {
      const text = plainText(page.content, 6000);
      if (!text) continue;
      chunk(text).forEach((part, i) =>
        docs.push({
          chunkKey: `page-${page.slug}-${i}`,
          sourceType: "PAGE",
          sourceId: page.id,
          sourceLabel: page.title,
          content: `${page.title}:\n${part}`,
        }),
      );
    }

    return docs;
  }

  // Full rebuild. Unchanged entries are skipped (no embedding call) and
  // entries for things that no longer exist are removed.
  async indexShoeMartData() {
    const docs = await this.buildAllDocs();

    const existing = await prisma.$queryRaw<{ chunkKey: string; content: string }[]>(Prisma.sql`
      SELECT "chunkKey", content FROM "document_embeddings" WHERE "isDeleted" = false
    `);
    const current = new Map(existing.map((e) => [e.chunkKey, e.content]));

    let indexed = 0;
    let skipped = 0;
    let failed = 0;
    for (const doc of docs) {
      if (current.get(doc.chunkKey) === doc.content) {
        skipped++;
        continue;
      }
      // Paced so the free embedding model doesn't start refusing (429)
      if (indexed + failed > 0) await new Promise((r) => setTimeout(r, 400));
      try {
        await this.indexDocument(
          doc.chunkKey,
          doc.sourceType,
          doc.sourceId,
          doc.content,
          doc.sourceLabel,
          doc.metadata,
        );
        indexed++;
      } catch (error) {
        failed++;
        console.error(`RAG: could not index ${doc.chunkKey}:`, (error as Error).message);
      }
    }

    const keep = docs.map((d) => d.chunkKey);
    const removed = await prisma.$executeRaw(Prisma.sql`
      UPDATE "document_embeddings"
      SET "isDeleted" = true, "deletedAt" = NOW()
      WHERE "isDeleted" = false AND "chunkKey" NOT IN (${Prisma.join(keep)})
    `);

    return {
      success: failed === 0,
      message: `Indexed ${indexed}, unchanged ${skipped}, removed ${removed}${failed ? `, failed ${failed}` : ""} (total ${docs.length} entries).`,
    };
  }

  // Keep one product up to date after it is added, edited or removed
  async syncProduct(productId: string) {
    const [product] = await loadProducts({ id: productId, ...LIVE_PRODUCT });
    if (!product) {
      await prisma.$executeRaw(Prisma.sql`
        UPDATE "document_embeddings" SET "isDeleted" = true, "deletedAt" = NOW()
        WHERE "chunkKey" = ${`product-${productId}`} AND "isDeleted" = false
      `);
      return;
    }
    const doc = this.productDoc(product);
    await this.indexDocument(
      doc.chunkKey,
      doc.sourceType,
      doc.sourceId,
      doc.content,
      doc.sourceLabel,
      doc.metadata,
    );
  }
}
