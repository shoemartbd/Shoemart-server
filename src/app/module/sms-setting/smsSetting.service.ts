import { prisma } from "../../lib/prisma";

const getSmsSettings = async () => {
  let settings = await prisma.smsSetting.findUnique({
    where: { id: "default" },
  });

  if (!settings) {
    settings = await prisma.smsSetting.create({
      data: { id: "default" },
    });
  }

  return settings;
};

const updateSmsSettings = async (payload: {
  enabled?: boolean;
  apiKey?: string | null;
  senderId?: string | null;
}) => {
  await getSmsSettings(); // ensure the default row exists

  return prisma.smsSetting.update({
    where: { id: "default" },
    data: payload,
  });
};

export const SmsSettingService = {
  getSmsSettings,
  updateSmsSettings,
};
