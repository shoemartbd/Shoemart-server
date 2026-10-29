import { OrderType } from "../../generated/prisma/enums";

const ORDER_NUMBER_PREFIX: Record<OrderType, string> = {
  ONLINE: "ONL",
  POS: "POS",
  LANDING_PAGE: "LP",
};

export const generateOrderNumber = (orderType: OrderType, orderSeq: number) => {
  return `${ORDER_NUMBER_PREFIX[orderType]}-${String(orderSeq).padStart(6, "0")}`;
};
