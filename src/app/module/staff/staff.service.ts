import status from "http-status";
import { prisma } from "../../lib/prisma";
import { auth } from "../../lib/auth";
import AppError from "../../errorHelpers/AppError";
import { Role, UserStatus } from "../../../generated/prisma/enums";
import { ALL_PERMISSIONS, PERMISSION_GROUPS } from "./staffPermissions";

// Drop unknown keys so a role only ever stores real permissions
const cleanPermissions = (permissions: string[]) =>
  Array.from(new Set(permissions.filter((p) => ALL_PERMISSIONS.includes(p))));

const getPermissionCatalog = () => PERMISSION_GROUPS;

// ── Roles ────────────────────────────────────────────────────────────────

const getRoles = async () => {
  return prisma.staffRole.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { users: { where: { isDeleted: false } } } },
    },
  });
};

const assertRoleNameFree = async (name: string, exceptId?: string) => {
  const clash = await prisma.staffRole.findUnique({ where: { name } });
  if (clash && clash.id !== exceptId) {
    throw new AppError(status.CONFLICT, `A role named "${name}" already exists`);
  }
};

const createRole = async (payload: { name: string; permissions: string[] }) => {
  const name = payload.name.trim();
  await assertRoleNameFree(name);
  return prisma.staffRole.create({
    data: { name, permissions: cleanPermissions(payload.permissions) },
  });
};

const updateRole = async (
  id: string,
  payload: { name?: string; permissions?: string[] },
) => {
  const existing = await prisma.staffRole.findUnique({ where: { id } });
  if (!existing) throw new AppError(status.NOT_FOUND, "Role not found");

  const name = payload.name?.trim();
  if (name && name !== existing.name) await assertRoleNameFree(name, id);

  return prisma.staffRole.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(payload.permissions && {
        permissions: cleanPermissions(payload.permissions),
      }),
    },
  });
};

const deleteRole = async (id: string) => {
  const existing = await prisma.staffRole.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });
  if (!existing) throw new AppError(status.NOT_FOUND, "Role not found");
  if (existing._count.users > 0) {
    throw new AppError(
      status.BAD_REQUEST,
      `${existing._count.users} staff account(s) still use "${existing.name}". Move them to another role first.`,
    );
  }
  return prisma.staffRole.delete({ where: { id } });
};

// ── Staff accounts ───────────────────────────────────────────────────────

const staffSelect = {
  id: true,
  name: true,
  email: true,
  status: true,
  image: true,
  createdAt: true,
  staffRole: { select: { id: true, name: true } },
  admin: { select: { contactNumber: true } },
} as const;

const getStaff = async (query: { staffRoleId?: string; searchTerm?: string }) => {
  const term = query.searchTerm?.trim();
  const users = await prisma.user.findMany({
    where: {
      role: Role.ADMIN,
      staffRoleId: query.staffRoleId || { not: null },
      isDeleted: false,
      ...(term && {
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { email: { contains: term, mode: "insensitive" } },
          { admin: { contactNumber: { contains: term } } },
        ],
      }),
    },
    orderBy: { createdAt: "desc" },
    select: staffSelect,
  });

  return users.map(({ admin, ...user }) => ({
    ...user,
    phone: admin?.contactNumber ?? null,
  }));
};

// Only accounts that are staff can be changed here, never full admins
const findStaffOrThrow = async (id: string) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.isDeleted || user.role !== Role.ADMIN || !user.staffRoleId) {
    throw new AppError(status.NOT_FOUND, "Staff account not found");
  }
  return user;
};

const assertRoleExists = async (staffRoleId: string) => {
  const role = await prisma.staffRole.findUnique({ where: { id: staffRoleId } });
  if (!role) throw new AppError(status.BAD_REQUEST, "Selected role does not exist");
};

const setPassword = async (userId: string, password: string) => {
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(password);
  await ctx.internalAdapter.updatePassword(userId, hash);
};

const createStaff = async (payload: {
  name: string;
  email: string;
  phone?: string;
  password: string;
  staffRoleId: string;
}) => {
  const email = payload.email.trim().toLowerCase();
  await assertRoleExists(payload.staffRoleId);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(status.CONFLICT, "An account with this email already exists");
  }

  // Created through Better Auth so the password is stored the same way as
  // every other account and the same login page works
  const result = await auth.api.signUpEmail({
    body: { name: payload.name.trim(), email, password: payload.password },
  });
  if (!result?.user) {
    throw new AppError(status.BAD_REQUEST, "Failed to create staff account");
  }
  const userId = result.user.id;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        role: Role.ADMIN,
        staffRoleId: payload.staffRoleId,
        emailVerified: true,
      },
    }),
    prisma.admin.create({
      data: {
        userId,
        name: payload.name.trim(),
        email,
        contactNumber: payload.phone?.trim() || null,
      },
    }),
    // Sign-up opens a session for the new account; the admin creating it
    // should not hold that session
    prisma.session.deleteMany({ where: { userId } }),
  ]);

  return (await getStaff({})).find((s) => s.id === userId);
};

const updateStaff = async (
  id: string,
  payload: {
    name?: string;
    phone?: string;
    staffRoleId?: string;
    status?: "ACTIVE" | "BLOCKED";
    password?: string;
  },
) => {
  const user = await findStaffOrThrow(id);
  if (payload.staffRoleId) await assertRoleExists(payload.staffRoleId);

  const name = payload.name?.trim();
  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(payload.staffRoleId && { staffRoleId: payload.staffRoleId }),
        ...(payload.status && { status: payload.status as UserStatus }),
      },
    }),
    prisma.admin.upsert({
      where: { userId: id },
      create: {
        userId: id,
        name: name || user.name,
        email: user.email,
        contactNumber: payload.phone?.trim() || null,
      },
      update: {
        ...(name && { name }),
        ...(payload.phone !== undefined && {
          contactNumber: payload.phone.trim() || null,
        }),
      },
    }),
    // A blocked account is signed out everywhere right away
    ...(payload.status === "BLOCKED"
      ? [prisma.session.deleteMany({ where: { userId: id } })]
      : []),
  ]);

  if (payload.password) {
    await setPassword(id, payload.password);
    await prisma.session.deleteMany({ where: { userId: id } });
  }

  return (await getStaff({})).find((s) => s.id === id);
};

const deleteStaff = async (id: string) => {
  await findStaffOrThrow(id);
  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        status: UserStatus.DELETED,
        // Frees the role so it can be deleted later
        staffRoleId: null,
        role: Role.USER,
      },
    }),
    prisma.admin.updateMany({
      where: { userId: id },
      data: { isDeleted: true, deletedAt: new Date() },
    }),
    prisma.session.deleteMany({ where: { userId: id } }),
    prisma.account.deleteMany({ where: { userId: id } }),
  ]);
  return { id };
};

export const StaffService = {
  getPermissionCatalog,
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  getStaff,
  createStaff,
  updateStaff,
  deleteStaff,
};
