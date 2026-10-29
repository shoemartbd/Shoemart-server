import { z } from "zod";
import { bdMobilePhoneSchema } from "../../utils/bdPhone";

export const createLandingPageZodSchema = z.object({
  productId: z.uuid("A valid product must be selected"),
  campaignTitle: z.string().min(1, "Campaign title is required"),
  campaignShortDescription: z.string().optional(),

  regularPriceLabel: z.string().optional(),
  offerPriceLabel: z.string().optional(),

  galleryHeading: z.string().optional(),
  galleryDescription: z.string().optional(),

  aboutHeading: z.string().optional(),
  aboutDescription: z.string().optional(),
  videoUrl: z.url().optional().or(z.literal("")),

  descriptionTitle: z.string().optional(),
  description: z.string().optional(),

  reviewHeading: z.string().optional(),

  orderFormHeading: z.string().optional(),
  orderButtonText: z.string().optional(),

  isActive: z.boolean().optional(),

  themeColor: z.string().optional(),
  showGallerySection: z.boolean().optional(),
  showAboutSection: z.boolean().optional(),
  showDescriptionSection: z.boolean().optional(),
  showReviewsSection: z.boolean().optional(),
  sectionOrder: z
    .array(z.enum(["price", "gallery", "about", "description", "reviews"]))
    .optional(),
});

export const updateLandingPageZodSchema = z.object({
  productId: z.uuid().optional(),
  campaignTitle: z.string().min(1).optional(),
  campaignShortDescription: z.string().optional(),

  regularPriceLabel: z.string().optional(),
  offerPriceLabel: z.string().optional(),

  galleryHeading: z.string().optional(),
  galleryDescription: z.string().optional(),
  // URLs of previously uploaded gallery images to keep (newly uploaded files are appended by the server)
  galleryImages: z.array(z.string()).optional(),

  aboutHeading: z.string().optional(),
  aboutDescription: z.string().optional(),
  videoUrl: z.url().optional().or(z.literal("")),

  descriptionTitle: z.string().optional(),
  description: z.string().optional(),

  reviewHeading: z.string().optional(),
  // URLs of previously uploaded review images to keep (newly uploaded files are appended by the server)
  reviewImages: z.array(z.string()).optional(),

  orderFormHeading: z.string().optional(),
  orderButtonText: z.string().optional(),

  isActive: z.boolean().optional(),

  themeColor: z.string().optional(),
  showGallerySection: z.boolean().optional(),
  showAboutSection: z.boolean().optional(),
  showDescriptionSection: z.boolean().optional(),
  showReviewsSection: z.boolean().optional(),
  sectionOrder: z
    .array(z.enum(["price", "gallery", "about", "description", "reviews"]))
    .optional(),
});

export const createGuestLandingOrderZodSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  companyName: z.string().trim().max(200).optional(),
  phone: bdMobilePhoneSchema,
  address: z.string().min(1, "Address is required"),
  district: z.string().min(1, "District is required"),
  productVariantId: z.uuid().optional().nullable(),
  quantity: z.number().int().positive(),
  shippingFee: z.number().nonnegative().optional(),
  checkoutSessionToken: z.string().optional(),
  notes: z.string().trim().max(1000).optional(),
  paymentMethod: z.enum(["COD", "BKASH"]).optional(),
});
