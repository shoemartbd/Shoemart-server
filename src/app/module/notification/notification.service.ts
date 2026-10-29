import { prisma } from "../../lib/prisma";
import { NotificationType, OrderStatus, PaymentStatus, Role } from "../../../generated/prisma/enums";
import type { Order } from "../../../generated/prisma/client";

const notifyOrderPlaced = async (order: Order) => {
  const recipients = new Map<string, NotificationType>();

  if (order.userId) {
    recipients.set(order.userId, NotificationType.ORDER_PLACED);
  }

  const admins = await prisma.user.findMany({
    where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
    select: { id: true },
  });
  for (const admin of admins) {
    recipients.set(admin.id, NotificationType.ORDER_PLACED);
  }

  if (recipients.size === 0) return;

  await prisma.notification.createMany({
    data: [...recipients.keys()].map((userId) => ({
      userId,
      orderId: order.id,
      type: NotificationType.ORDER_PLACED,
      title:
        userId === order.userId
          ? "Order Placed Successfully"
          : "New Order Received",
      message:
        userId === order.userId
          ? `Your order #${order.orderNumber} has been placed successfully.`
          : `A new order #${order.orderNumber} has been placed.`,
    })),
  });
};

const notifyOrderStatusChanged = async (
  order: Order,
  previousStatus: OrderStatus,
) => {
  if (!order.userId || order.orderStatus === previousStatus) return;

  await prisma.notification.create({
    data: {
      userId: order.userId,
      orderId: order.id,
      type: NotificationType.ORDER_STATUS_CHANGED,
      title: "Order Status Updated",
      message: `Your order #${order.orderNumber} is now ${order.orderStatus.toLowerCase()}.`,
    },
  });
};

const notifyPaymentStatusChanged = async (
  order: Order,
  previousPaymentStatus: PaymentStatus,
) => {
  if (!order.userId || order.paymentStatus === previousPaymentStatus) return;

  await prisma.notification.create({
    data: {
      userId: order.userId,
      orderId: order.id,
      type: NotificationType.PAYMENT_STATUS_CHANGED,
      title: "Payment Status Updated",
      message: `Payment for your order #${order.orderNumber} is now ${order.paymentStatus.toLowerCase()}.`,
    },
  });
};

const notifyOrderReturnProcessed = async (order: Order, refundAmount: number) => {
  if (!order.userId) return;

  await prisma.notification.create({
    data: {
      userId: order.userId,
      orderId: order.id,
      type: NotificationType.ORDER_RETURN_PROCESSED,
      title: "Return Processed",
      message: `A return of ৳${refundAmount.toFixed(2)} has been processed for your order #${order.orderNumber}.`,
    },
  });
};

const getMyNotifications = async (userId: string, limit: number) => {
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return { notifications, unreadCount };
};

const markAsRead = async (userId: string, id: string) => {
  await prisma.notification.updateMany({
    where: { id, userId },
    data: { isRead: true },
  });
};

const markAllAsRead = async (userId: string) => {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
};

export const NotificationService = {
  notifyOrderPlaced,
  notifyOrderStatusChanged,
  notifyPaymentStatusChanged,
  notifyOrderReturnProcessed,
  getMyNotifications,
  markAsRead,
  markAllAsRead,
};
