import status from "http-status";
import { Role, UserStatus } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import {
  IChangeUserRolePayload,
  IChangeUserStatusPayload,
  IUpdateAdminPayload,
} from "./admin.interface";
import { IRequestUser } from "../../interfaces/requestUser";

const getAllAdmins = async () => {
  const admins = await prisma.admin.findMany({
    include: {
      user: true,
    },
  });
  return admins;
};

// Dashboard → Users: search (name / email), role and status filters, sort and
// pages. role=ADMIN also lists super admins.
const USER_SORT_FIELDS = ["name", "email", "role", "status", "createdAt"] as const;

const getAllUsers = async (query: Record<string, unknown> = {}) => {
  const term = typeof query.searchTerm === "string" ? query.searchTerm.trim() : "";
  const role = typeof query.role === "string" ? query.role : "";
  const userStatus = typeof query.status === "string" ? query.status : "";
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
  const sortBy = USER_SORT_FIELDS.includes(query.sortBy as (typeof USER_SORT_FIELDS)[number])
    ? (query.sortBy as (typeof USER_SORT_FIELDS)[number])
    : "createdAt";
  const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

  const roles =
    role === Role.ADMIN
      ? [Role.ADMIN, Role.SUPER_ADMIN]
      : (Object.values(Role) as string[]).includes(role)
        ? [role as Role]
        : undefined;

  const where = {
    isDeleted: false,
    ...(roles && { role: { in: roles } }),
    ...((Object.values(UserStatus) as string[]).includes(userStatus) && {
      status: userStatus as UserStatus,
    }),
    ...(term && {
      OR: [
        { name: { contains: term, mode: "insensitive" as const } },
        { email: { contains: term, mode: "insensitive" as const } },
      ],
    }),
  };

  const [total, data, byRole] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.groupBy({ by: ["role"], where: { isDeleted: false }, _count: true }),
  ]);

  const count = (r: Role) => byRole.find((x) => x.role === r)?._count ?? 0;
  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      // For the role tabs
      roleCounts: {
        all: byRole.reduce((s, x) => s + x._count, 0),
        ADMIN: count(Role.ADMIN) + count(Role.SUPER_ADMIN),
        USER: count(Role.USER),
        WHOLESALER: count(Role.WHOLESALER),
      },
    },
  };
};

const getAdminById = async (id: string) => {
  const admin = await prisma.admin.findUnique({
    where: {
      id,
    },
    include: {
      user: true,
    },
  });
  return admin;
};

const updateAdmin = async (id: string, payload: IUpdateAdminPayload) => {
  const isAdminExist = await prisma.admin.findUnique({
    where: {
      id,
    },
  });

  if (!isAdminExist) {
    throw new AppError(status.NOT_FOUND, "Admin Or Super Admin not found");
  }

  const { admin } = payload;

  const updatedAdmin = await prisma.admin.update({
    where: {
      id,
    },
    data: {
      ...admin,
    },
  });

  return updatedAdmin;
};

const deleteAdmin = async (id: string, user: IRequestUser) => {
  const isAdminExist = await prisma.admin.findUnique({
    where: {
      id,
    },
  });

  if (!isAdminExist) {
    throw new AppError(status.NOT_FOUND, "Admin Or Super Admin not found");
  }

  if (isAdminExist.id === user.userId) {
    throw new AppError(status.BAD_REQUEST, "You cannot delete yourself");
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.admin.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    await tx.user.update({
      where: { id: isAdminExist.userId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        status: UserStatus.DELETED,
      },
    });

    await tx.session.deleteMany({
      where: { userId: isAdminExist.userId },
    });

    await tx.account.deleteMany({
      where: { userId: isAdminExist.userId },
    });

    const admin = await getAdminById(id);

    return admin;
  });

  return result;
};

const deleteUser = async (id: string, adminUser: IRequestUser) => {
  const userToDelete = await prisma.user.findUnique({
    where: { id },
  });

  if (!userToDelete) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  if (userToDelete.id === adminUser.userId) {
    throw new AppError(status.BAD_REQUEST, "You cannot delete yourself");
  }

  const requester = await prisma.user.findUnique({
    where: { id: adminUser.userId },
  });
  if (
    requester?.role === Role.ADMIN &&
    (userToDelete.role === Role.ADMIN || userToDelete.role === Role.SUPER_ADMIN)
  ) {
    throw new AppError(
      status.FORBIDDEN,
      "Admin cannot delete another Admin or Super Admin",
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const deletedUser = await tx.user.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        status: UserStatus.DELETED,
      },
    });

    await tx.session.deleteMany({ where: { userId: id } });
    await tx.account.deleteMany({ where: { userId: id } });

    return deletedUser;
  });

  return result;
};

const changeUserStatus = async (
  user: IRequestUser,
  payload: IChangeUserStatusPayload,
) => {
  const isAdminExists = await prisma.admin.findUniqueOrThrow({
    where: {
      email: user.email,
    },
    include: {
      user: true,
    },
  });

  const { userId, userStatus } = payload;

  const userToChangeStatus = await prisma.user.findUniqueOrThrow({
    where: {
      id: userId,
    },
  });

  const selfStatusChange = isAdminExists.userId === userId;

  if (selfStatusChange) {
    throw new AppError(status.BAD_REQUEST, "You cannot change your own status");
  }

  if (
    isAdminExists.user.role === Role.ADMIN &&
    userToChangeStatus.role === Role.SUPER_ADMIN
  ) {
    throw new AppError(
      status.BAD_REQUEST,
      "You cannot change the status of super admin. Only super admin can change the status of another super admin",
    );
  }

  if (
    isAdminExists.user.role === Role.ADMIN &&
    userToChangeStatus.role === Role.ADMIN
  ) {
    throw new AppError(
      status.BAD_REQUEST,
      "You cannot change the status of another admin. Only super admin can change the status of another admin",
    );
  }

  if (userStatus === UserStatus.DELETED) {
    throw new AppError(
      status.BAD_REQUEST,
      "You cannot set user status to deleted.",
    );
  }

  const updatedUser = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      status: userStatus,
    },
  });

  return updatedUser;
};

const changeUserRole = async (
  user: IRequestUser,
  payload: IChangeUserRolePayload,
) => {
  const actingAdmin = await prisma.admin.findUniqueOrThrow({
    where: { email: user.email },
    include: { user: true },
  });

  if (actingAdmin.user.role !== Role.SUPER_ADMIN) {
    throw new AppError(
      status.FORBIDDEN,
      "Only Super Admin can change user roles",
    );
  }

  const { userId, role } = payload;

  const userToChangeRole = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { admin: true },
  });

  const selfRoleChange = actingAdmin.userId === userId;

  if (selfRoleChange) {
    throw new AppError(status.BAD_REQUEST, "You cannot change your own role");
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { role },
    });

    if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
      if (!userToChangeRole.admin) {
        await tx.admin.create({
          data: {
            userId: userToChangeRole.id,
            name: userToChangeRole.name,
            email: userToChangeRole.email,
            profilePhoto: userToChangeRole.image,
          },
        });
      }
    } else if (role === Role.USER || role === Role.WHOLESALER) {
      if (userToChangeRole.admin) {
        await tx.admin.delete({
          where: { userId: userToChangeRole.id },
        });
      }
    }

    return updatedUser;
  });

  return result;
};

const getStats = async () => {
  const [adminCount, superAdminCount, userCount] = await Promise.all([
    prisma.user.count({ where: { role: Role.ADMIN, isDeleted: false } }),
    prisma.user.count({ where: { role: Role.SUPER_ADMIN, isDeleted: false } }),
    prisma.user.count({ where: { role: Role.USER, isDeleted: false } }),
  ]);

  return {
    adminCount,
    superAdminCount,
    userCount,
  };
};

export const AdminService = {
  getAllAdmins,
  getAdminById,
  updateAdmin,
  deleteAdmin,
  changeUserStatus,
  changeUserRole,
  getAllUsers,
  deleteUser,
  getStats,
};
