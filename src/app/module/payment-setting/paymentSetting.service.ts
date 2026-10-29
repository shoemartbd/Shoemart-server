import { prisma } from "../../lib/prisma";
import { cached, invalidates, MINUTE } from "../../utils/memoryCache";

const getPaymentSettings = async () => {
  let settings = await prisma.paymentSetting.findUnique({
    where: { id: "default" },
  });

  if (!settings) {
    settings = await prisma.paymentSetting.create({
      data: { id: "default" },
    });
  }

  return settings;
};

const updateCodSettings = async (payload: { codEnabled?: boolean }) => {
  await getPaymentSettings(); // ensure the default row exists

  return prisma.paymentSetting.update({
    where: { id: "default" },
    data: payload,
  });
};

const updateSslcommerzSettings = async (payload: {
  sslcommerzEnabled?: boolean;
  sslcommerzMode?: string;
  sslcommerzStoreId?: string | null;
  sslcommerzStorePassword?: string | null;
}) => {
  await getPaymentSettings();

  return prisma.paymentSetting.update({
    where: { id: "default" },
    data: payload,
  });
};

const updateBkashSettings = async (payload: {
  bkashEnabled?: boolean;
  bkashMode?: string;
  bkashAppKey?: string | null;
  bkashAppSecret?: string | null;
  bkashUsername?: string | null;
  bkashPassword?: string | null;
}) => {
  await getPaymentSettings();

  return prisma.paymentSetting.update({
    where: { id: "default" },
    data: payload,
  });
};

// What the storefront may know: which methods to offer, never credentials.
// Cash on Delivery is always offered.
const getPublicPaymentSettings = async () => {
  const settings = await getPaymentSettings();
  return {
    codEnabled: true,
    sslcommerzEnabled: settings.sslcommerzEnabled,
    bkashEnabled: settings.bkashEnabled,
  };
};

const PAYMENT = ["payment-settings", "payment-methods"];

export const PaymentSettingService = {
  getPaymentSettings: cached("payment-settings", 5 * MINUTE, getPaymentSettings),
  getPublicPaymentSettings: cached("payment-methods", 5 * MINUTE, getPublicPaymentSettings),
  updateBkashSettings: invalidates(PAYMENT, updateBkashSettings),
  updateCodSettings: invalidates(PAYMENT, updateCodSettings),
  updateSslcommerzSettings: invalidates(PAYMENT, updateSslcommerzSettings),
};
