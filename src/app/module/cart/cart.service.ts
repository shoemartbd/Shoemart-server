import status from "http-status";
import { prisma } from "../../lib/prisma";
import AppError from "../../errorHelpers/AppError";

const getCart = async (userId: string) => {
  let cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          product: {
            include: {
              shop: true,
            },
          },
          productVariant: true,
        },
      },
    },
  });

  // If no cart exists for the user, create one
  if (!cart) {
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userExists) {
      throw new AppError(status.NOT_FOUND, "User not found");
    }

    cart = await prisma.cart.create({
      data: { userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                shop: true,
              },
            },
            productVariant: true,
          },
        },
      },
    });
  }

  return cart;
};

const addToCart = async (
  userId: string,
  payload: { productId: string; productVariantId?: string | null; quantity: number }
) => {
  const product = await prisma.product.findUnique({
    where: { id: payload.productId },
    include: { variants: true },
  });

  if (!product) {
    throw new AppError(status.NOT_FOUND, "Product not found");
  }

  // Stock check
  if (product.type === "VARIABLE" && payload.productVariantId) {
    const variant = product.variants.find((v) => v.id === payload.productVariantId);
    if (!variant) {
      throw new AppError(status.NOT_FOUND, "Product variant not found");
    }
    if (variant.quantity < payload.quantity) {
      throw new AppError(status.BAD_REQUEST, "Insufficient stock for this variation");
    }
  } else {
    if (product.stock < payload.quantity) {
      throw new AppError(status.BAD_REQUEST, "Insufficient stock");
    }
  }

  // Get or create cart
  let cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) {
    cart = await prisma.cart.create({ data: { userId } });
  }

  // Check if item already exists in cart
  const existingItem = await prisma.cartItem.findFirst({
    where: {
      cartId: cart.id,
      productId: payload.productId,
      productVariantId: payload.productVariantId || null,
    },
  });

  if (existingItem) {
    const targetQuantity = existingItem.quantity + payload.quantity;
    if (product.type === "VARIABLE" && payload.productVariantId) {
      const variant = product.variants.find((v) => v.id === payload.productVariantId);
      if (variant && variant.quantity < targetQuantity) {
        throw new AppError(status.BAD_REQUEST, "Insufficient stock for this variation");
      }
    } else {
      if (product.stock < targetQuantity) {
        throw new AppError(status.BAD_REQUEST, "Insufficient stock");
      }
    }

    // Update quantity
    return await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: targetQuantity },
    });
  } else {
    // Create new item
    return await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: payload.productId,
        productVariantId: payload.productVariantId || null,
        quantity: payload.quantity,
      },
    });
  }
};

const updateCartItemQuantity = async (
  userId: string,
  payload: { productId: string; productVariantId?: string | null; quantity: number },
) => {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) throw new AppError(status.NOT_FOUND, "Cart not found");

  const existingItem = await prisma.cartItem.findFirst({
    where: {
      cartId: cart.id,
      productId: payload.productId,
      productVariantId: payload.productVariantId || null,
    },
  });

  if (!existingItem) throw new AppError(status.NOT_FOUND, "Item not found in cart");

  if (payload.quantity <= 0) {
    return await prisma.cartItem.delete({ where: { id: existingItem.id } });
  }

  // Verify stock
  const product = await prisma.product.findUnique({
    where: { id: payload.productId },
    include: { variants: true },
  });

  if (product) {
    if (product.type === "VARIABLE" && payload.productVariantId) {
      const variant = product.variants.find((v) => v.id === payload.productVariantId);
      if (variant && variant.quantity < payload.quantity) {
        throw new AppError(status.BAD_REQUEST, "Insufficient stock for this variation");
      }
    } else {
      if (product.stock < payload.quantity) {
        throw new AppError(status.BAD_REQUEST, "Insufficient stock");
      }
    }
  }

  return await prisma.cartItem.update({
    where: { id: existingItem.id },
    data: { quantity: payload.quantity },
  });
};

const removeFromCart = async (
  userId: string,
  productId: string,
  productVariantId?: string | null,
) => {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) throw new AppError(status.NOT_FOUND, "Cart not found");

  const existingItem = await prisma.cartItem.findFirst({
    where: {
      cartId: cart.id,
      productId,
      productVariantId: productVariantId || null,
    },
  });

  if (!existingItem) throw new AppError(status.NOT_FOUND, "Item not found in cart");

  await prisma.cartItem.delete({ where: { id: existingItem.id } });
  return { message: "Item removed from cart" };
};

const clearCart = async (userId: string) => {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) throw new AppError(status.NOT_FOUND, "Cart not found");

  await prisma.cartItem.deleteMany({
    where: { cartId: cart.id },
  });

  return { message: "Cart cleared" };
};

export const CartService = {
  getCart,
  addToCart,
  updateCartItemQuantity,
  removeFromCart,
  clearCart,
};
