import status from "http-status";
// The configured instance (API key/secret applied in cloudinary.config)
import { cloudinaryUpload as cloudinary } from "../../config/cloudinary.config";
import { prisma } from "../../lib/prisma";
import AppError from "../../errorHelpers/AppError";
import { envVars } from "../../config/env";
import { cached, invalidates, MINUTE } from "../../utils/memoryCache";

const FOLDER = "shoemart/sample-works";
const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } =
  envVars.CLOUDINARY;

// PDFs are often larger than the API host accepts (Vercel: 4.5 MB), so the
// browser uploads straight to Cloudinary with this short-lived signature
const getUploadSignature = () => {
  const timestamp = Math.round(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder: FOLDER },
    CLOUDINARY_API_SECRET,
  );
  return {
    timestamp,
    signature,
    folder: FOLDER,
    apiKey: CLOUDINARY_API_KEY,
    cloudName: CLOUDINARY_CLOUD_NAME,
  };
};

// Only files from our own Cloudinary account can be linked
const assertOwnFile = (url: string) => {
  if (!url.startsWith(`https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/`)) {
    throw new AppError(status.BAD_REQUEST, "Upload the PDF here, links from elsewhere are not accepted");
  }
};

type SampleWorkInput = {
  title: string;
  description?: string | null;
  fileUrl: string;
  publicId?: string | null;
  fileSize?: number | null;
  order?: number;
  isActive?: boolean;
};

const getPublicSampleWorks = async () => {
  return prisma.sampleWork.findMany({
    where: { isActive: true },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      fileUrl: true,
      fileSize: true,
    },
  });
};

const getAllSampleWorks = async () => {
  return prisma.sampleWork.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });
};

const createSampleWork = async (payload: SampleWorkInput) => {
  assertOwnFile(payload.fileUrl);
  return prisma.sampleWork.create({
    data: {
      title: payload.title.trim(),
      description: payload.description?.trim() || null,
      fileUrl: payload.fileUrl,
      publicId: payload.publicId ?? null,
      fileSize: payload.fileSize ?? null,
      order: payload.order ?? 0,
      isActive: payload.isActive ?? true,
    },
  });
};

// Removing an old file is best effort; the record change matters more
const destroyFile = async (publicId?: string | null) => {
  if (!publicId) return;
  await cloudinary.uploader.destroy(publicId, { resource_type: "image" }).catch(() => undefined);
};

const updateSampleWork = async (id: string, payload: Partial<SampleWorkInput>) => {
  const existing = await prisma.sampleWork.findUnique({ where: { id } });
  if (!existing) throw new AppError(status.NOT_FOUND, "Sample work not found");
  if (payload.fileUrl) assertOwnFile(payload.fileUrl);

  const updated = await prisma.sampleWork.update({
    where: { id },
    data: {
      ...(payload.title !== undefined && { title: payload.title.trim() }),
      ...(payload.description !== undefined && {
        description: payload.description?.trim() || null,
      }),
      ...(payload.fileUrl && {
        fileUrl: payload.fileUrl,
        publicId: payload.publicId ?? null,
        fileSize: payload.fileSize ?? null,
      }),
      ...(payload.order !== undefined && { order: payload.order }),
      ...(payload.isActive !== undefined && { isActive: payload.isActive }),
    },
  });

  // A replaced PDF no longer needs to be stored
  if (payload.fileUrl && payload.fileUrl !== existing.fileUrl) {
    await destroyFile(existing.publicId);
  }
  return updated;
};

const deleteSampleWork = async (id: string) => {
  const existing = await prisma.sampleWork.findUnique({ where: { id } });
  if (!existing) throw new AppError(status.NOT_FOUND, "Sample work not found");
  await prisma.sampleWork.delete({ where: { id } });
  await destroyFile(existing.publicId);
  return { id };
};

// Cloudinary accounts block public PDF delivery by default ("deny or ACL
// failure"). A signed download through the Cloudinary API is not affected,
// so View / Download go through here and get a link valid for an hour.
const getFileUrl = async (id: string, download: boolean) => {
  const item = await prisma.sampleWork.findUnique({ where: { id } });
  // Hidden ones still open, so the admin can preview them
  if (!item) throw new AppError(status.NOT_FOUND, "Sample work not found");
  if (!item.publicId) return item.fileUrl;

  return cloudinary.utils.private_download_url(item.publicId, "pdf", {
    resource_type: "image",
    type: "upload",
    attachment: download,
    expires_at: Math.round(Date.now() / 1000) + 60 * 60,
  });
};

export const SampleWorkService = {
  getFileUrl,
  getUploadSignature,
  getPublicSampleWorks: cached("sample-works", 5 * MINUTE, getPublicSampleWorks),
  getAllSampleWorks,
  createSampleWork: invalidates(["sample-works"], createSampleWork),
  updateSampleWork: invalidates(["sample-works"], updateSampleWork),
  deleteSampleWork: invalidates(["sample-works"], deleteSampleWork),
};
