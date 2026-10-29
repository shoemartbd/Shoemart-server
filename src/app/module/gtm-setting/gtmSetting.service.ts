import status from "http-status";
import { prisma } from "../../lib/prisma";
import AppError from "../../errorHelpers/AppError";
import { cached, invalidates, MINUTE } from "../../utils/memoryCache";

const getGtmSettings = async () => {
  return prisma.gtmSetting.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
};

// What the storefront needs: nothing at all unless tracking is switched on
const getPublicGtmSettings = async () => {
  const settings = await getGtmSettings();
  if (!settings.isEnabled || !settings.containerId) return null;
  return {
    containerId: settings.containerId,
    scriptDomain: settings.scriptDomain,
  };
};

const updateGtmSettings = async (payload: {
  isEnabled?: boolean;
  containerId?: string;
  scriptDomain?: string;
}) => {
  const current = await getGtmSettings();
  const containerId =
    payload.containerId === undefined ? current.containerId : payload.containerId || null;
  const isEnabled = payload.isEnabled ?? current.isEnabled;

  if (isEnabled && !containerId) {
    throw new AppError(
      status.BAD_REQUEST,
      "Add the GTM container ID before turning tracking on",
    );
  }

  return prisma.gtmSetting.update({
    where: { id: "default" },
    data: {
      isEnabled,
      containerId,
      ...(payload.scriptDomain !== undefined && {
        // Stored without a trailing slash: the client appends /gtm.js
        scriptDomain: payload.scriptDomain.replace(/\/+$/, "") || null,
      }),
    },
  });
};

export const GtmSettingService = {
  getGtmSettings,
  getPublicGtmSettings: cached("gtm-settings", 5 * MINUTE, getPublicGtmSettings),
  updateGtmSettings: invalidates(["gtm-settings"], updateGtmSettings),
};
