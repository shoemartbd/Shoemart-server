import { Role } from "../../generated/prisma/enums";
import { envVars } from "../config/env";
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";

export const seedSuperAdmin = async () => {
  try {
    const isSuperAdminExist = await prisma.user.findFirst({
      where: {
        role: Role.SUPER_ADMIN,
      },
    });

    if (isSuperAdminExist) {
      console.log("Super admin already exists. Skipping seeding super admin.");
      return;
    }

    const superAdminUser = await auth.api.signUpEmail({
      body: {
        email: envVars.SUPER_ADMIN_EMAIL,
        password: envVars.SUPER_ADMIN_PASSWORD,
        name: "Super Admin",
        role: Role.SUPER_ADMIN,
        needPasswordChange: false,
        rememberMe: false,
      },
    });

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: {
          id: superAdminUser.user.id,
        },
        data: {
          emailVerified: true,
        },
      });

      await tx.admin.create({
        data: {
          userId: superAdminUser.user.id,
          name: "Super Admin",
          email: envVars.SUPER_ADMIN_EMAIL,
        },
      });
    });

    const superAdmin = await prisma.admin.findFirst({
      where: {
        email: envVars.SUPER_ADMIN_EMAIL,
      },
      include: {
        user: true,
      },
    });

    console.log("Super Admin Created ", superAdmin);
  } catch (error) {
    console.error("Error seeding super admin: ", error);
    await prisma.user.delete({
      where: {
        email: envVars.SUPER_ADMIN_EMAIL,
      },
    });
  }
};

// Single-vendor store: exactly one Shop row must exist — every product,
// order, coupon, etc. resolves to it instead of a per-seller shop.
export const seedDefaultShop = async () => {
  try {
    const existingShop = await prisma.shop.findFirst();

    if (existingShop) {
      console.log("Store already exists. Skipping store seed.");
      return;
    }

    const superAdmin = await prisma.user.findFirst({
      where: { role: Role.SUPER_ADMIN },
    });

    if (!superAdmin) {
      console.log("No super admin found yet. Skipping store seed.");
      return;
    }

    const shop = await prisma.shop.create({
      data: {
        name: "Shoe Mart",
        vendorId: superAdmin.id,
      },
    });

    console.log("Store created ", shop);
  } catch (error) {
    console.error("Error seeding store: ", error);
  }
};
