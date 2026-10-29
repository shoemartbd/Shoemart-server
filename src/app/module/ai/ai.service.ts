import { LLMService } from "../rag/llm.service";
import { prisma } from "../../lib/prisma";
import AppError from "../../errorHelpers/AppError";
import status from "http-status";
import { Role } from "../../../generated/prisma/enums";

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Make sure the short description is a bullet list even if the model sent
// an array of points or plain sentences instead of <ul><li> HTML.
const toBulletList = (value: unknown): string => {
  if (typeof value === "string" && /<li[\s>]/i.test(value)) return value.trim();

  const points = (
    Array.isArray(value)
      ? value.map(String)
      : String(value ?? "").split(/\n+|(?<=[.!?])\s+/)
  )
    .map((p) => p.replace(/<[^>]*>/g, "").replace(/^[\s•*\-–]+/, "").trim())
    .filter(Boolean);

  if (points.length === 0) return "";
  return `<ul>${points.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>`;
};

const generateProductData = async (title: string) => {
  const llmService = new LLMService();
  const prompt = `You are an expert e-commerce copywriter. Based on the product title '${title}', generate a detailed and engaging product description and SEO tags.
  
  Return the response as a JSON object with the following fields:
  1. 'description': A detailed HTML formatted description (using <p>, <ul>, <li>, <strong> tags) including features and benefits.
  2. 'shortDescription': 4 to 5 short key points about the product, as an HTML bullet list: <ul><li>point</li>...</ul>. Each point one short line (max ~10 words), e.g. a key feature or benefit.
  3. 'tags': An array of 5 SEO-friendly search keywords.
  
  Return ONLY the JSON object. Do not include markdown code blocks.`;

  const data = await llmService.generateJson<{
    description: string;
    shortDescription: string | string[];
    tags: string[];
  }>(
    prompt,
    (v) =>
      v &&
      typeof v === "object" &&
      typeof v.description === "string" &&
      (typeof v.shortDescription === "string" ||
        Array.isArray(v.shortDescription)),
  );

  return {
    description: data.description,
    shortDescription: toBulletList(data.shortDescription),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
  };
};

const getRecommendations = async (productId: string) => {
  // 1. Fetch the current product
  const currentProduct = await prisma.product.findUnique({
    where: { id: productId },
    include: { category: true },
  });

  if (!currentProduct) {
    throw new AppError(status.NOT_FOUND, "Product not found");
  }

  // 2. Fetch up to 20 products from the same category (excluding current)
  const candidateProducts = await prisma.product.findMany({
    where: {
      categoryId: currentProduct.categoryId,
      id: { not: productId },
      stock: { gt: 0 },
    },
    take: 20,
    select: {
      id: true,
      name: true,
      shortDescription: true,
      sellPrice: true,
      images: true,
      tags: true,
    },
  });

  if (candidateProducts.length === 0) {
    return [];
  }

  // 3. Ask Gemini to pick the top 4 most relevant ones
  const llmService = new LLMService();
  const candidateList = candidateProducts
    .map(
      (p, i) =>
        `${i + 1}. ID: ${p.id} | Name: ${p.name} | Tags: ${p.tags?.join(", ")}`,
    )
    .join("\n");

  const prompt = `You are an AI recommendation engine for an e-commerce platform.

A customer is viewing this product:
- Name: "${currentProduct.name}"
- Category: "${currentProduct.category?.name}"
- Tags: "${currentProduct.tags?.join(", ")}"

From the following candidate products in the same category, select the TOP 4 most relevant recommendations.
Prioritize similarity in use-case, tags, and complementary items.

Candidates:
${candidateList}

Return ONLY a JSON array of exactly 4 product IDs (strings), like this:
["id1", "id2", "id3", "id4"]

Return ONLY the JSON array. No explanation, no markdown.`;

  const recommendedIds = await llmService.generateJson<string[]>(
    prompt,
    (v) => Array.isArray(v) && v.every((id) => typeof id === "string"),
  );

  // 4. Fetch the full recommended products
  const recommendations = await prisma.product.findMany({
    where: { id: { in: recommendedIds } },
    select: {
      id: true,
      name: true,
      shortDescription: true,
      sellPrice: true,
      regularPrice: true,
      images: true,
      category: { select: { name: true } },
    },
  });

  // Return them in the same order Gemini suggested
  return recommendedIds
    .map((id) => recommendations.find((p) => p.id === id))
    .filter(Boolean);
};

const analyzeBusiness = async () => {
  // 1. Gather Rich Data for Analysis
  const [orderStats, categorySales, topProducts, summary] = await Promise.all(
    [
      // Revenue Summary
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      // Sales by Category
      prisma.category.findMany({
        include: {
          products: {
            select: {
              orderItems: {
                select: {
                  price: true,
                  quantity: true,
                },
              },
            },
          },
        },
      }),
      // Top 5 Products by Quantity
      prisma.orderItem.groupBy({
        by: ["productId"],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      }),
      // Total counts
      prisma.user.count({ where: { role: Role.USER } }),
    ],
  );

  // Process category sales for easier reading by AI
  const processedCategorySales = (categorySales as any[])
    .map((cat) => ({
      name: cat.name,
      totalRevenue: cat.products.reduce(
        (acc: number, p: any) =>
          acc +
          p.orderItems.reduce(
            (sum: number, item: any) => sum + item.price * item.quantity,
            0,
          ),
        0,
      ),
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  // Fetch top product names
  const topProductDetails = await prisma.product.findMany({
    where: { id: { in: topProducts.map((p) => p.productId) } },
    select: { name: true },
  });

  // 2. Prepare Prompt for Gemini
  const llmService = new LLMService();
  const context = {
    totalRevenue: orderStats._sum.totalAmount || 0,
    totalOrders: orderStats._count.id,
    totalCustomers: summary,
    categoryPerformance: processedCategorySales,
    topSellingProducts: topProductDetails.map((p) => p.name),
  };

  const prompt = `You are a Business Analyst. Analyze this data:
  ${JSON.stringify(context, null, 2)}
  
  Return ONLY a JSON object: {"analysis": "HTML_STRING"}
  The HTML_STRING must use <h3>, <p>, <ul>, <li> tags for structure.
  Do not include any other text or markdown code blocks.`;

  const { analysis } = await llmService.generateJson<{ analysis: string }>(
    prompt,
    (v) => v && typeof v.analysis === "string",
  );
  const finalHTML = analysis;

  return {
    insights: finalHTML,
    generatedAt: new Date().toISOString(),
  };
};

export const AIService = {
  generateProductData,
  getRecommendations,
  analyzeBusiness,
};
