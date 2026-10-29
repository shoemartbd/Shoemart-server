import status from "http-status";
import { prisma } from "../../lib/prisma";
import AppError from "../../errorHelpers/AppError";

const createAttribute = async (payload: { name: string }) => {
  const existing = await prisma.attribute.findFirst({
    where: { name: payload.name },
  });

  if (existing) {
    throw new AppError(
      status.BAD_REQUEST,
      "Attribute with this name already exists"
    );
  }

  const attribute = await prisma.attribute.create({
    data: { name: payload.name },
    include: { values: true },
  });

  return attribute;
};

const getAllAttributes = async () => {
  return await prisma.attribute.findMany({
    include: { values: true },
    orderBy: { createdAt: "desc" },
  });
};

const getAttributeById = async (id: string) => {
  const attribute = await prisma.attribute.findUnique({
    where: { id },
    include: { values: true },
  });

  if (!attribute) {
    throw new AppError(status.NOT_FOUND, "Attribute not found");
  }

  return attribute;
};

const updateAttribute = async (id: string, payload: { name: string }) => {
  const attribute = await prisma.attribute.findUnique({ where: { id } });

  if (!attribute) {
    throw new AppError(status.NOT_FOUND, "Attribute not found");
  }

  const existing = await prisma.attribute.findFirst({
    where: {
      name: payload.name,
      NOT: { id },
    },
  });

  if (existing) {
    throw new AppError(
      status.BAD_REQUEST,
      "Attribute with this name already exists"
    );
  }

  const updated = await prisma.attribute.update({
    where: { id },
    data: { name: payload.name },
    include: { values: true },
  });

  return updated;
};

const deleteAttribute = async (id: string) => {
  const attribute = await prisma.attribute.findUnique({ where: { id } });

  if (!attribute) {
    throw new AppError(status.NOT_FOUND, "Attribute not found");
  }

  await prisma.attribute.delete({ where: { id } });

  return { message: "Attribute deleted successfully" };
};

const addAttributeValue = async (
  attributeId: string,
  payload: { value: string }
) => {
  const attribute = await prisma.attribute.findUnique({
    where: { id: attributeId },
  });

  if (!attribute) {
    throw new AppError(status.NOT_FOUND, "Attribute not found");
  }

  const existing = await prisma.attributeValue.findUnique({
    where: {
      value_attributeId: {
        value: payload.value,
        attributeId: attributeId,
      },
    },
  });

  if (existing) {
    throw new AppError(
      status.BAD_REQUEST,
      "Value already exists for this attribute"
    );
  }

  const attributeValue = await prisma.attributeValue.create({
    data: {
      value: payload.value,
      attributeId: attributeId,
    },
  });

  return attributeValue;
};

const deleteAttributeValue = async (valueId: string) => {
  const value = await prisma.attributeValue.findUnique({
    where: { id: valueId },
  });

  if (!value) {
    throw new AppError(status.NOT_FOUND, "Attribute value not found");
  }

  await prisma.attributeValue.delete({ where: { id: valueId } });

  return { message: "Attribute value deleted successfully" };
};

const updateAttributeValue = async (
  valueId: string,
  payload: { value: string }
) => {
  const value = await prisma.attributeValue.findUnique({
    where: { id: valueId },
  });

  if (!value) {
    throw new AppError(status.NOT_FOUND, "Attribute value not found");
  }

  const existing = await prisma.attributeValue.findFirst({
    where: {
      value: payload.value,
      attributeId: value.attributeId,
      NOT: { id: valueId },
    },
  });

  if (existing) {
    throw new AppError(
      status.BAD_REQUEST,
      "Value already exists for this attribute"
    );
  }

  const updatedValue = await prisma.attributeValue.update({
    where: { id: valueId },
    data: { value: payload.value },
  });

  return updatedValue;
};

export const AttributeService = {
  createAttribute,
  getAllAttributes,
  getAttributeById,
  updateAttribute,
  deleteAttribute,
  addAttributeValue,
  deleteAttributeValue,
  updateAttributeValue,
};
