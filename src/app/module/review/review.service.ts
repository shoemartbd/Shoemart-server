import status from "http-status";
import { prisma } from "../../lib/prisma";
import AppError from "../../errorHelpers/AppError";
import { OrderStatus } from "../../../generated/prisma/enums";

const createReview = async (userId: string, payload: { productId: string; rating: number; comment: string }) => {
  const hasPurchased = await prisma.order.findFirst({
    where: {
      userId,
      orderStatus: OrderStatus.DELIVERED,
      items: {
        some: {
          productId: payload.productId,
        },
      },
    },
  });

  if (!hasPurchased) {
    throw new AppError(
      status.FORBIDDEN,
      "You can only review products you have purchased and received",
    );
  }

  const existingReview = await prisma.review.findUnique({
    where: {
      userId_productId: {
        userId,
        productId: payload.productId,
      },
    },
  });

  if (existingReview) {
    throw new AppError(status.BAD_REQUEST, "You have already reviewed this product");
  }

  const review = await prisma.review.create({
    data: {
      userId,
      productId: payload.productId,
      rating: payload.rating,
      comment: payload.comment,
    },
    include: {
      user: {
        select: { name: true, image: true },
      },
    },
  });

  return review;
};

const getProductReviews = async (productId: string) => {
  return await prisma.review.findMany({
    where: { productId },
    include: {
      user: {
        select: { name: true, image: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

const getMyReviews = async (userId: string) => {
  return await prisma.review.findMany({
    where: { userId },
    include: {
      product: {
        select: { name: true, images: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

const deleteReview = async (userId: string, reviewId: string, role: string) => {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
  });

  if (!review) {
    throw new AppError(status.NOT_FOUND, "Review not found");
  }

  if (role !== "ADMIN" && role !== "SUPER_ADMIN" && review.userId !== userId) {
    throw new AppError(status.FORBIDDEN, "Access denied");
  }

  await prisma.review.delete({ where: { id: reviewId } });
  return { message: "Review deleted successfully" };
};

export const ReviewService = {
  createReview,
  getProductReviews,
  deleteReview,
  getMyReviews,
};
