import { prisma } from "../../lib/prisma";
import { cached, invalidates, MINUTE } from "../../utils/memoryCache";

const getShippingSettings = async () => {
  let settings = await prisma.shippingSetting.findUnique({
    where: { id: "default" },
  });

  if (!settings) {
    settings = await prisma.shippingSetting.create({
      data: {
        id: "default",
        insideDhakaShippingFee: 70,
        outsideDhakaShippingFee: 130,
      },
    });
  }

  return settings;
};

const updateShippingSettings = async (payload: {
  insideDhakaShippingFee?: number;
  outsideDhakaShippingFee?: number;
}) => {
  // Ensure the default settings exist first
  await getShippingSettings();

  const result = await prisma.shippingSetting.update({
    where: { id: "default" },
    data: payload,
  });

  return result;
};

export const ShippingSettingService = {
  getShippingSettings: cached("shipping-settings", 5 * MINUTE, getShippingSettings),
  updateShippingSettings: invalidates(["shipping-settings"], updateShippingSettings),
};
