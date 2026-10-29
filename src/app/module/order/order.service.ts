import status from "http-status";
import { BlockedPhoneService, normalizePhone } from "../blocked-phone/blockedPhone.service";
import { prisma } from "../../lib/prisma";
import AppError from "../../errorHelpers/AppError";
import { OrderStatus, OrderType, PaymentStatus } from "../../../generated/prisma/enums";
import { IQueryParams } from "../../interfaces/query.interface";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { generateOrderNumber } from "../../utils/generateOrderNumber";
import { NotificationService } from "../notification/notification.service";
import { AbandonedCheckoutService } from "../abandoned-checkout/abandonedCheckout.service";
import { PathaoCourierService } from "../courier/pathaoCourier.service";
import { SteadfastCourierService } from "../courier/steadfastCourier.service";
import { RedxCourierService } from "../courier/redxCourier.service";
import { CourierProvider } from "../../../generated/prisma/enums";
import { SmsService } from "../sms/sms.service";
import { BDCourierService } from "./bdCourier.service";
import { SiteSettingService } from "../site-setting/siteSetting.service";

const COMMISSION_RATE = 0.1; // 10% commission

const createOrder = async (
  userId: string | null,
  payload: {
    fullName: string;
    companyName?: string;
    phone: string;
    email?: string;
    address: string;
    district: string;
    notes?: string;
    items?: { productId: string; productVariantId?: string | null; quantity: number }[];
    couponId?: string | null;
    discountAmount?: number;
    shippingFee?: number;
    orderType?: OrderType;
    checkoutSessionToken?: string;
    paymentMethod?: string;
  },
) => {
  // Numbers marked as fraud can't order (storefront and landing pages)
  await BlockedPhoneService.assertPhoneAllowed(payload.phone);

  let orderItemsToProcess: {
    productId: string;
    productVariantId: string | null;
    quantity: number;
    product: any;
    variant: any;
    sellPrice: number;
  }[] = [];
  let isFromCart = false;

  // 1. Determine items to process
  if (payload.items && payload.items.length > 0) {
    // Direct items (Buy Now)
    for (const item of payload.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { variants: true },
      });
      if (!product) throw new AppError(status.NOT_FOUND, `Product not found: ${item.productId}`);
      
      let sellPrice = product.sellPrice;
      let variant = null;
      if (product.type === "VARIABLE" && item.productVariantId) {
        variant = product.variants.find((v) => v.id === item.productVariantId);
        if (!variant) throw new AppError(status.NOT_FOUND, `Product variant not found: ${item.productVariantId}`);
        sellPrice = variant.sellPrice;
      }

      orderItemsToProcess.push({
        productId: item.productId,
        productVariantId: item.productVariantId || null,
        quantity: item.quantity,
        product,
        variant,
        sellPrice,
      });
    }
  } else {
    // Items from Cart (guests always pass explicit items, so this path requires a logged-in user)
    if (!userId) {
      throw new AppError(status.BAD_REQUEST, "No items provided for order");
    }

    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                variants: true,
              },
            },
            productVariant: true,
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new AppError(status.BAD_REQUEST, "Your cart is empty");
    }
    
    orderItemsToProcess = cart.items.map((item) => {
      let sellPrice = item.product.sellPrice;
      if (item.product.type === "VARIABLE" && item.productVariant) {
        sellPrice = item.productVariant.sellPrice;
      }
      return {
        productId: item.productId,
        productVariantId: item.productVariantId,
        quantity: item.quantity,
        product: item.product,
        variant: item.productVariant,
        sellPrice,
      };
    });
    isFromCart = true;
  }

  // 2. Perform Order creation in a Transaction
  const order = await prisma.$transaction(async (tx) => {
    let totalAmount = 0;

    // Verify stock and calculate total
    for (const item of orderItemsToProcess) {
      if (item.variant) {
        if (item.variant.quantity < item.quantity) {
          throw new AppError(
            status.BAD_REQUEST,
            `Insufficient stock for variation of product: ${item.product.name}`,
          );
        }
      } else {
        if (item.product.stock < item.quantity) {
          throw new AppError(
            status.BAD_REQUEST,
            `Insufficient stock for product: ${item.product.name}`,
          );
        }
      }
      totalAmount += item.sellPrice * item.quantity;
    }

    const discountAmount = payload.discountAmount || 0;
    const shippingFee = payload.shippingFee || 0;
    const finalTotalAmount = Math.max(0, totalAmount + shippingFee - discountAmount);

    // Create Order
    const order = await tx.order.create({
      data: {
        userId,
        orderType: payload.orderType || OrderType.ONLINE,
        totalAmount: finalTotalAmount,
        discountAmount,
        shippingFee,
        couponId: payload.couponId || null,
        fullName: payload.fullName,
        companyName: payload.companyName?.trim() || null,
        phone: payload.phone,
        email: payload.email?.trim() || null,
        address: payload.address,
        district: payload.district,
        notes: payload.notes,
        orderStatus: OrderStatus.PENDING,
        paymentMethod: payload.paymentMethod || "COD",
      },
    });

    const orderWithNumber = await tx.order.update({
      where: { id: order.id },
      data: { orderNumber: generateOrderNumber(order.orderType, order.orderSeq) },
    });

    // Create OrderItems and reduce stock
    for (const item of orderItemsToProcess) {
      const itemTotal = item.sellPrice * item.quantity;
      const itemCommission = itemTotal * COMMISSION_RATE;
      const vendorEarning = itemTotal - itemCommission;

      await tx.orderItem.create({
        data: {
          orderId: order.id,
          productId: item.productId,
          productVariantId: item.productVariantId,
          quantity: item.quantity,
          price: item.sellPrice,
          costPrice: item.variant?.purchasePrice ?? item.product.purchasePrice,
          shopId: item.product.shopId,
          platformEarning: itemCommission,
          vendorEarning: vendorEarning,
        },
      });

      // Update stock
      if (item.productVariantId) {
        await tx.productVariant.update({
          where: { id: item.productVariantId },
          data: {
            quantity: {
              decrement: item.quantity,
            },
          },
        });
        // Keep main product stock decrement in sync
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      } else {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      }
    }

    // 3. Clear Cart Items (either all if checked out full cart, or only processed items) — guests have no cart
    const cart = userId ? await tx.cart.findUnique({ where: { userId } }) : null;
    if (cart) {
      if (isFromCart) {
        await tx.cartItem.deleteMany({
          where: { cartId: cart.id },
        });
      } else {
        for (const item of orderItemsToProcess) {
          await tx.cartItem.deleteMany({
            where: {
              cartId: cart.id,
              productId: item.productId,
              productVariantId: item.productVariantId || null,
            },
          });
        }
      }
    }

    return orderWithNumber;
  });

  await NotificationService.notifyOrderPlaced(order);

  if (order.phone) {
    await SmsService.sendSms(
      order.phone,
      `Hello ${order.fullName || "Customer"}, your order (ID: ${order.orderNumber}) has been received! We will start processing soon. Thank you for shopping with us.`,
    );
  }

  if (payload.checkoutSessionToken) {
    await AbandonedCheckoutService.deleteBySessionToken(payload.checkoutSessionToken);
  }

  return order;
};

// Only what the order screens, invoice and Excel export read. Full product
// rows (description HTML etc.) made big lists slow to load.
const orderListInclude = {
  items: {
    select: {
      id: true,
      orderId: true,
      productId: true,
      productVariantId: true,
      quantity: true,
      returnedQuantity: true,
      price: true,
      status: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          images: true,
          sku: true,
          type: true,
          attributes: true,
        },
      },
      productVariant: {
        select: { id: true, combination: true, sku: true, image: true },
      },
    },
  },
  user: {
    select: { id: true, name: true, email: true },
  },
};

// ?from=2026-10-01&to=2026-10-31 (whole days, Bangladesh time)
const DHAKA_OFFSET = "+06:00";
const dateRangeWhere = (from?: unknown, to?: unknown) => {
  const valid = (v: unknown): v is string =>
    typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const createdAt: { gte?: Date; lte?: Date } = {};
  if (valid(from)) createdAt.gte = new Date(`${from}T00:00:00${DHAKA_OFFSET}`);
  if (valid(to)) createdAt.lte = new Date(`${to}T23:59:59.999${DHAKA_OFFSET}`);
  return Object.keys(createdAt).length ? { createdAt } : null;
};

const buildOrderListQuery = (queryParams: IQueryParams) => {
  const { from, to, ...rest } = queryParams;
  const orderQuery = new QueryBuilder(prisma.order, rest, {
    searchableFields: ["orderNumber", "fullName", "companyName", "phone", "address", "district"],
    filterableFields: ["orderStatus", "paymentStatus", "userId", "orderType"],
  })
    .search()
    .filter()
    .sort()
    .paginate()
    .include(orderListInclude);

  const range = dateRangeWhere(from, to);
  if (range) orderQuery.where(range);
  return orderQuery;
};

const getAllOrders = async (queryParams: IQueryParams) => {
  const result = await buildOrderListQuery(queryParams).execute();
  // Flag orders whose phone number is blocked (one extra lookup per page)
  const orders = result.data as { phone?: string | null }[];
  const blocked = await BlockedPhoneService.findBlocked(orders.map((o) => o.phone));
  return {
    ...result,
    data: orders.map((o) => ({
      ...o,
      isPhoneBlocked: o.phone ? blocked.has(normalizePhone(o.phone)) : false,
    })),
  };
};

const EXPORT_LIMIT = 10000;

// Same filters as the list, every matching order (up to EXPORT_LIMIT)
const exportOrders = async (queryParams: IQueryParams) => {
  const result = await buildOrderListQuery({
    ...queryParams,
    page: "1",
    limit: String(EXPORT_LIMIT),
  }).execute();
  return { orders: result.data, total: result.meta.total, limit: EXPORT_LIMIT };
};

const getOrderById = async (id: string, userId?: string, role?: string) => {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: true,
          productVariant: true,
          shop: true,
        },
      },
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!order) {
    throw new AppError(status.NOT_FOUND, "Order not found");
  }

  // If not admin, the requester must be the order's owner
  if (role !== "ADMIN" && role !== "SUPER_ADMIN" && order.userId !== userId) {
    throw new AppError(status.FORBIDDEN, "Access denied");
  }

  return order;
};

// Public — used by the guest-safe order-confirmation ("Thank You") page and the
// order-tracking page. No auth/ownership check, so only customer-facing fields are
// selected — no vendorEarning/platformEarning/costPrice/userId/couponId etc.
const PUBLIC_ORDER_SELECT = {
  id: true,
  orderNumber: true,
  orderType: true,
  orderStatus: true,
  paymentStatus: true,
  paymentMethod: true,
  totalAmount: true,
  discountAmount: true,
  shippingFee: true,
  vatAmount: true,
  fullName: true,
  companyName: true,
  phone: true,
  email: true,
  address: true,
  district: true,
  notes: true,
  createdAt: true,
  items: {
    select: {
      id: true,
      quantity: true,
      returnedQuantity: true,
      price: true,
      status: true,
      product: { select: { id: true, name: true, images: true } },
      productVariant: { select: { id: true, combination: true } },
    },
  },
} as const;

const getPublicOrderById = async (id: string) => {
  const order = await prisma.order.findUnique({
    where: { id },
    select: PUBLIC_ORDER_SELECT,
  });

  if (!order) {
    throw new AppError(status.NOT_FOUND, "Order not found");
  }

  return order;
};

// Public order tracking — requires BOTH orderNumber and phone to match. orderNumber
// alone (e.g. "ONL-000123") is sequential/guessable, so phone acts as the second
// factor that prevents enumerating other customers' orders.
const trackOrder = async (orderNumber: string, phone: string) => {
  const order = await prisma.order.findFirst({
    where: { orderNumber: orderNumber.trim(), phone: phone.trim() },
    select: PUBLIC_ORDER_SELECT,
  });

  if (!order) {
    throw new AppError(
      status.NOT_FOUND,
      "No order found with that order number and phone number. Please check your details.",
    );
  }

  return order;
};

const checkOrderFraud = async (id: string, userId?: string, role?: string) => {
  const order = await getOrderById(id, userId, role);

  const phone = order.phone?.trim();
  const isValidPhone = !!phone && phone.toUpperCase() !== "N/A" && phone.length >= 10;

  if (!isValidPhone) {
    return { hasPhone: false as const };
  }

  const bdCourierService = new BDCourierService();
  const report = await bdCourierService.checkPhone(phone);

  return { hasPhone: true as const, phone, report };
};

const updateOrderStatus = async (id: string, statusValue: OrderStatus) => {
  const existingOrder = await prisma.order.findUnique({ where: { id } });
  if (!existingOrder) throw new AppError(status.NOT_FOUND, "Order not found");

  // Single-vendor: every item in the order ships together, so the order's
  // status is the single source of truth — item status always mirrors it.
  const updatedOrder = await prisma.$transaction(async (tx) => {
    const order = await tx.order.update({
      where: { id },
      data: { orderStatus: statusValue },
    });

    await tx.orderItem.updateMany({
      where: { orderId: id },
      data: { status: statusValue },
    });

    return order;
  });

  await NotificationService.notifyOrderStatusChanged(updatedOrder, existingOrder.orderStatus);

  if (updatedOrder.phone && statusValue !== existingOrder.orderStatus) {
    const name = updatedOrder.fullName || "Customer";
    const orderRef = updatedOrder.orderNumber || updatedOrder.id;
    const statusMessages: Partial<Record<OrderStatus, string>> = {
      [OrderStatus.CONFIRMED]: `Hi ${name}, your order (ID: ${orderRef}) has been confirmed.`,
      [OrderStatus.IN_COURIER]: `Hi ${name}, your order (ID: ${orderRef}) has been handed to the courier. The delivery team will contact you soon.`,
      [OrderStatus.DELIVERED]: `Hi ${name}, your order (ID: ${orderRef}) has been delivered successfully! Thank you for shopping with us.`,
      [OrderStatus.CANCELLED]: `Hi ${name}, your order (ID: ${orderRef}) has been cancelled. If this wasn't you, please contact support.`,
    };
    const message = statusMessages[statusValue];
    if (message) await SmsService.sendSms(updatedOrder.phone, message);
  }

  return updatedOrder;
};

const updateOrderDiscount = async (id: string, discountAmount: number) => {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!order) throw new AppError(status.NOT_FOUND, "Order not found");

  const itemsSubtotal = order.items.reduce(
    (sum, item) => sum + item.price * (item.quantity - item.returnedQuantity),
    0,
  );

  const newTotalAmount = Math.max(
    0,
    itemsSubtotal + order.shippingFee + order.vatAmount - discountAmount,
  );

  const updatedOrder = await prisma.order.update({
    where: { id },
    data: { discountAmount, totalAmount: newTotalAmount },
  });

  return updatedOrder;
};

const updatePaymentStatus = async (id: string, paymentStatus: PaymentStatus) => {
  const existingOrder = await prisma.order.findUnique({ where: { id } });
  if (!existingOrder) throw new AppError(status.NOT_FOUND, "Order not found");

  const updatedOrder = await prisma.order.update({
    where: { id },
    data: { paymentStatus: paymentStatus },
  });

  await NotificationService.notifyPaymentStatusChanged(updatedOrder, existingOrder.paymentStatus);

  return updatedOrder;
};

const assignCourier = async (
  id: string,
  provider: CourierProvider,
  options: { redxArea?: { id: number; name: string } } = {},
) => {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: { include: { product: { select: { name: true } } } } },
  });
  if (!order) throw new AppError(status.NOT_FOUND, "Order not found");
  if (!order.fullName || !order.phone || !order.address || !order.district) {
    throw new AppError(status.BAD_REQUEST, "Order is missing recipient name/phone/address/district");
  }
  if (order.courierProvider) {
    throw new AppError(
      status.BAD_REQUEST,
      `Order is already assigned to ${order.courierProvider} (${order.courierTrackingCode || order.courierConsignmentId})`,
    );
  }

  const orderInput = {
    orderNumber: order.orderNumber || order.id,
    fullName: order.fullName,
    phone: order.phone,
    address: order.address,
    district: order.district,
    notes: order.notes,
    totalAmount: order.totalAmount,
    paymentStatus: order.paymentStatus,
  };

  const itemQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);

  let result: { consignmentId?: string; trackingCode?: string; statusText: string };
  if (provider === CourierProvider.PATHAO) {
    result = await PathaoCourierService.createOrder(orderInput, itemQuantity);
  } else if (provider === CourierProvider.REDX) {
    if (!options.redxArea) {
      throw new AppError(status.BAD_REQUEST, "Select the RedX delivery area");
    }
    result = await RedxCourierService.createOrder(
      orderInput,
      options.redxArea,
      order.items.map((item) => ({
        name: item.product?.name ?? "Item",
        quantity: item.quantity - item.returnedQuantity,
        price: item.price,
      })),
    );
  } else {
    result = await SteadfastCourierService.createOrder(orderInput);
  }

  const assigned = await prisma.order.update({
    where: { id },
    data: {
      courierProvider: provider,
      courierConsignmentId: result.consignmentId,
      courierTrackingCode: result.trackingCode,
      courierStatus: result.statusText,
      courierAssignedAt: new Date(),
    },
  });

  // Handed to the courier: move it to IN_COURIER (sends the SMS/notification).
  // Delivered or cancelled orders keep their status.
  if (assigned.orderStatus === OrderStatus.PENDING || assigned.orderStatus === OrderStatus.CONFIRMED) {
    return updateOrderStatus(id, OrderStatus.IN_COURIER);
  }
  return assigned;
};

const updateOrderItemStatus = async (
  itemId: string,
  statusValue: OrderStatus,
) => {
  const orderItem = await prisma.orderItem.findUnique({
    where: { id: itemId },
  });

  if (!orderItem) {
    throw new AppError(status.NOT_FOUND, "Order item not found");
  }

  const updatedItem = await prisma.orderItem.update({
    where: { id: itemId },
    data: { status: statusValue },
  });

  // Also update the main order status to match the item status
  // In a more complex system, we would check if all items are shipped/delivered
  // but for now, we propagate the status to give immediate feedback to the user
  const existingOrder = await prisma.order.findUnique({ where: { id: orderItem.orderId } });
  const updatedOrder = await prisma.order.update({
    where: { id: orderItem.orderId },
    data: { orderStatus: statusValue },
  });

  if (existingOrder) {
    await NotificationService.notifyOrderStatusChanged(updatedOrder, existingOrder.orderStatus);
  }

  return updatedItem;
};

const updateOrderItem = async (
  itemId: string,
  payload: {
    status?: OrderStatus;
    productId?: string;
    productVariantId?: string | null;
    quantity?: number;
  },
) => {
  const orderItem = await prisma.orderItem.findUnique({
    where: { id: itemId },
    include: { order: true },
  });

  if (!orderItem) {
    throw new AppError(status.NOT_FOUND, "Order item not found");
  }

  const isContentEdit =
    payload.productId !== undefined ||
    payload.productVariantId !== undefined ||
    payload.quantity !== undefined;

  if (!isContentEdit) {
    // Status-only update — identical behavior to updateOrderItemStatus
    return updateOrderItemStatus(itemId, payload.status as OrderStatus);
  }

  if (orderItem.order.orderType !== OrderType.POS) {
    if (orderItem.status !== OrderStatus.PENDING && orderItem.status !== OrderStatus.CONFIRMED) {
      throw new AppError(
        status.BAD_REQUEST,
        "This item can no longer be edited once it has shipped",
      );
    }
  }

  const newProductId = payload.productId ?? orderItem.productId;
  const newProductVariantId =
    payload.productVariantId !== undefined ? payload.productVariantId : orderItem.productVariantId;
  const newQuantity = payload.quantity ?? orderItem.quantity;

  const product = await prisma.product.findUnique({
    where: { id: newProductId },
    include: { variants: true },
  });
  if (!product) throw new AppError(status.NOT_FOUND, `Product not found: ${newProductId}`);

  let variant = null;
  if (newProductVariantId) {
    variant = product.variants.find((v) => v.id === newProductVariantId);
    if (!variant) {
      throw new AppError(status.NOT_FOUND, `Product variant not found: ${newProductVariantId}`);
    }
  }

  const sellPrice = variant?.sellPrice ?? product.sellPrice;
  const costPrice = variant?.purchasePrice ?? product.purchasePrice;

  const updatedItem = await prisma.$transaction(async (tx) => {
    // Restore stock for the old product/variant
    if (orderItem.productVariantId) {
      await tx.productVariant.update({
        where: { id: orderItem.productVariantId },
        data: { quantity: { increment: orderItem.quantity } },
      });
    }
    await tx.product.update({
      where: { id: orderItem.productId },
      data: { stock: { increment: orderItem.quantity } },
    });

    // Re-validate stock for the new product/variant (post-restore)
    if (newProductVariantId) {
      const freshVariant = await tx.productVariant.findUnique({
        where: { id: newProductVariantId },
      });
      if (!freshVariant || freshVariant.quantity < newQuantity) {
        throw new AppError(
          status.BAD_REQUEST,
          `Insufficient stock for variation of product: ${product.name}`,
        );
      }
      await tx.productVariant.update({
        where: { id: newProductVariantId },
        data: { quantity: { decrement: newQuantity } },
      });
      await tx.product.update({
        where: { id: newProductId },
        data: { stock: { decrement: newQuantity } },
      });
    } else {
      const freshProduct = await tx.product.findUnique({ where: { id: newProductId } });
      if (!freshProduct || freshProduct.stock < newQuantity) {
        throw new AppError(status.BAD_REQUEST, `Insufficient stock for product: ${product.name}`);
      }
      await tx.product.update({
        where: { id: newProductId },
        data: { stock: { decrement: newQuantity } },
      });
    }

    const itemTotal = sellPrice * newQuantity;
    const platformEarning = itemTotal * COMMISSION_RATE;
    const vendorEarning = itemTotal - platformEarning;

    const item = await tx.orderItem.update({
      where: { id: itemId },
      data: {
        productId: newProductId,
        productVariantId: newProductVariantId,
        quantity: newQuantity,
        price: sellPrice,
        costPrice,
        vendorEarning,
        platformEarning,
        ...(payload.status !== undefined && { status: payload.status }),
      },
    });

    // Recompute Order.totalAmount from all items on this order
    const allItems = await tx.orderItem.findMany({ where: { orderId: orderItem.orderId } });
    const itemsTotal = allItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const newTotalAmount = Math.max(
      0,
      itemsTotal +
        orderItem.order.shippingFee +
        orderItem.order.vatAmount -
        orderItem.order.discountAmount,
    );

    await tx.order.update({
      where: { id: orderItem.orderId },
      data: {
        totalAmount: newTotalAmount,
        ...(payload.status !== undefined && { orderStatus: payload.status }),
      },
    });

    return item;
  });

  if (payload.status !== undefined) {
    const updatedOrder = await prisma.order.findUnique({ where: { id: orderItem.orderId } });
    if (updatedOrder) {
      await NotificationService.notifyOrderStatusChanged(updatedOrder, orderItem.order.orderStatus);
    }
  }

  return updatedItem;
};

const deleteOrder = async (id: string) => {
  return await prisma.$transaction(async (tx) => {
    // Delete order items first
    await tx.orderItem.deleteMany({
      where: { orderId: id },
    });

    // Delete the order
    return await tx.order.delete({
      where: { id },
    });
  });
};

export type BulkOrderAction =
  | { action: "status"; status: OrderStatus }
  | { action: "payment"; paymentStatus: PaymentStatus }
  | { action: "courier"; provider: CourierProvider }
  | { action: "delete" };

// Runs one action on many orders, one at a time through the single-order
// functions (so SMS, notifications and courier rules all apply). One failure
// doesn't stop the rest; failures come back with their reason.
const bulkOrderAction = async (orderIds: string[], payload: BulkOrderAction) => {
  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    select: { id: true, orderNumber: true },
  });
  const numberOf = new Map(orders.map((o) => [o.id, o.orderNumber || o.id.slice(0, 8)]));

  let succeeded = 0;
  const failed: { id: string; orderNumber: string; message: string }[] = [];

  for (const id of orderIds) {
    try {
      if (!numberOf.has(id)) throw new AppError(status.NOT_FOUND, "Order not found");
      if (payload.action === "status") await updateOrderStatus(id, payload.status);
      else if (payload.action === "payment") await updatePaymentStatus(id, payload.paymentStatus);
      else if (payload.action === "courier") await assignCourier(id, payload.provider);
      else await deleteOrder(id);
      succeeded++;
    } catch (error) {
      failed.push({
        id,
        orderNumber: numberOf.get(id) ?? id.slice(0, 8),
        message: error instanceof Error ? error.message : "Failed",
      });
    }
  }

  return { succeeded, failed };
};

// Orders without an account (online checkout and landing pages) are only
// taken while guest checkout is on in Dashboard → Site Settings
const assertGuestCheckoutEnabled = async () => {
  const settings = await SiteSettingService.getSiteSettings();
  if (!settings.guestCheckoutEnabled) {
    throw new AppError(status.FORBIDDEN, "Please log in to place an order");
  }
};

const createGuestOrder = async (payload: Parameters<typeof createOrder>[1]) => {
  await assertGuestCheckoutEnabled();
  return createOrder(null, { ...payload, orderType: OrderType.ONLINE });
};

export const OrderService = {
  createOrder,
  createGuestOrder,
  assertGuestCheckoutEnabled,
  exportOrders,
  getAllOrders,
  getOrderById,
  getPublicOrderById,
  trackOrder,
  updateOrderStatus,
  updateOrderDiscount,
  updatePaymentStatus,
  assignCourier,
  bulkOrderAction,
  deleteOrder,
  updateOrderItemStatus,
  updateOrderItem,
  checkOrderFraud,
};
