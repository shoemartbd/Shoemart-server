import { Request } from "express";
import status from "http-status";
import { prisma } from "../../lib/prisma";
import AppError from "../../errorHelpers/AppError";
import { HeroMediaType, HeroSliderType } from "../../../generated/prisma/enums";
import { cached, invalidates, MINUTE } from "../../utils/memoryCache";

const MAX_BANNERS = 2;

const createHeroSlider = async (req: Request) => {
  const file = req.file as any;
  if (!file) {
    throw new AppError(status.BAD_REQUEST, "No image or video file uploaded");
  }

  const mediaType: HeroMediaType = file.mimetype?.startsWith("video/")
    ? HeroMediaType.VIDEO
    : HeroMediaType.IMAGE;

  const type: HeroSliderType =
    req.body?.type === HeroSliderType.BANNER
      ? HeroSliderType.BANNER
      : HeroSliderType.SLIDE;
  const link =
    typeof req.body?.link === "string" && req.body.link.trim()
      ? req.body.link.trim()
      : null;

  if (type === HeroSliderType.BANNER && mediaType === HeroMediaType.VIDEO) {
    throw new AppError(
      status.BAD_REQUEST,
      "Offer banners must be images. Videos can only be used as slides.",
    );
  }

  if (type === HeroSliderType.BANNER) {
    const bannerCount = await prisma.heroSlider.count({
      where: { type: HeroSliderType.BANNER },
    });
    if (bannerCount >= MAX_BANNERS) {
      throw new AppError(
        status.BAD_REQUEST,
        `Only ${MAX_BANNERS} side banners are allowed. Delete one first.`,
      );
    }
  }

  const result = await prisma.heroSlider.create({
    data: {
      image: file.path,
      mediaType,
      type,
      link,
    },
  });

  return result;
};

const getHeroSliders = async () => {
  const result = await prisma.heroSlider.findMany({
    orderBy: { createdAt: "desc" },
  });
  return result;
};

const deleteHeroSlider = async (id: string) => {
  const result = await prisma.heroSlider.delete({
    where: { id },
  });
  return result;
};

export const HeroSliderService = {
  createHeroSlider: invalidates(["hero-sliders"], createHeroSlider),
  getHeroSliders: cached("hero-sliders", 5 * MINUTE, getHeroSliders),
  deleteHeroSlider: invalidates(["hero-sliders"], deleteHeroSlider),
};
