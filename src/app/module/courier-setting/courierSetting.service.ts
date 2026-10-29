import { prisma } from "../../lib/prisma";

const getCourierSettings = async () => {
  let settings = await prisma.courierSetting.findUnique({
    where: { id: "default" },
  });

  if (!settings) {
    settings = await prisma.courierSetting.create({
      data: { id: "default" },
    });
  }

  return settings;
};

const updatePathaoSettings = async (payload: {
  pathaoEnabled?: boolean;
  pathaoBaseUrl?: string | null;
  pathaoClientId?: string | null;
  pathaoClientSecret?: string | null;
  pathaoUsername?: string | null;
  pathaoPassword?: string | null;
  pathaoStoreId?: string | null;
}) => {
  await getCourierSettings(); // ensure the default row exists

  return prisma.courierSetting.update({
    where: { id: "default" },
    data: payload,
  });
};

const updateSteadfastSettings = async (payload: {
  steadfastEnabled?: boolean;
  steadfastApiKey?: string | null;
  steadfastSecretKey?: string | null;
}) => {
  await getCourierSettings();

  return prisma.courierSetting.update({
    where: { id: "default" },
    data: payload,
  });
};

const updateRedxSettings = async (payload: {
  redxEnabled?: boolean;
  redxMode?: string;
  redxAccessToken?: string | null;
  redxPickupStoreId?: string | null;
  redxWebhookToken?: string | null;
}) => {
  await getCourierSettings();

  return prisma.courierSetting.update({
    where: { id: "default" },
    data: payload,
  });
};

export const CourierSettingService = {
  getCourierSettings,
  updatePathaoSettings,
  updateSteadfastSettings,
  updateRedxSettings,
};
