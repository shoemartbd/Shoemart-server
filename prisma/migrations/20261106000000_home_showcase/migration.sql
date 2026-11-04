-- AlterTable
ALTER TABLE "home_promos" ADD COLUMN     "showcaseEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showcaseLeftImage" TEXT,
ADD COLUMN     "showcaseLeftLink" TEXT,
ADD COLUMN     "showcaseRightImage" TEXT,
ADD COLUMN     "showcaseRightLink" TEXT,
ADD COLUMN     "showcaseVideo" TEXT,
ADD COLUMN     "showcaseVideoLink" TEXT;
