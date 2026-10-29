/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextFunction, Request, Response } from "express";
import status from "http-status";
import { Role, UserStatus } from "../../generated/prisma/enums";
import { envVars } from "../config/env";
import AppError from "../errorHelpers/AppError";
import { prisma } from "../lib/prisma";
import { CookieUtils } from "../utils/cookie";
import { jwtUtils } from "../utils/jwt";
import {
  hasStaffPermission,
  requiredStaffPermission,
} from "../module/staff/staffPermissions";

const staffRoleInclude = {
  staffRole: { select: { permissions: true } },
} as const;

// Permissions for staff (an ADMIN with a staff role); undefined = full access
const getStaffPermissions = (user: {
  role: Role;
  staffRoleId: string | null;
  staffRole: { permissions: string[] } | null;
}) =>
  user.role === Role.ADMIN && user.staffRoleId
    ? (user.staffRole?.permissions ?? [])
    : undefined;

export const checkAuth =
  (...authRoles: Role[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      //Session Token Verification
      const sessionToken = CookieUtils.getCookie(
        req,
        "better-auth.session_token",
      );

      if (!sessionToken) {
        throw new AppError(
          status.UNAUTHORIZED,
          "Unauthorized access! No session token provided.",
        );
      }

      if (sessionToken) {
        const sessionExists = await prisma.session.findFirst({
          where: {
            token: sessionToken,
            expiresAt: {
              gt: new Date(),
            },
          },
          include: {
            user: { include: staffRoleInclude },
          },
        });

        if (sessionExists && sessionExists.user) {
          const user = sessionExists.user;

          const now = new Date();
          const expiresAt = new Date(sessionExists.expiresAt);
          const createdAt = new Date(sessionExists.createdAt);

          const sessionLifeTime = expiresAt.getTime() - createdAt.getTime();
          const timeRemaining = expiresAt.getTime() - now.getTime();
          const percentRemaining = (timeRemaining / sessionLifeTime) * 100;

          if (percentRemaining < 20) {
            res.setHeader("X-Session-Refresh", "true");
            res.setHeader("X-Session-Expires-At", expiresAt.toISOString());
            res.setHeader("X-Time-Remaining", timeRemaining.toString());

            console.log("Session Expiring Soon!!");
          }

          if (
            user.status === UserStatus.BLOCKED ||
            user.status === UserStatus.DELETED
          ) {
            throw new AppError(
              status.UNAUTHORIZED,
              "Unauthorized access! User is not active.",
            );
          }

          if (user.isDeleted) {
            throw new AppError(
              status.UNAUTHORIZED,
              "Unauthorized access! User is deleted.",
            );
          }

          if (authRoles.length > 0 && !authRoles.includes(user.role)) {
            throw new AppError(
              status.FORBIDDEN,
              "Forbidden access! You do not have permission to access this resource.",
            );
          }

          req.user = {
            userId: user.id,
            role: user.role,
            email: user.email,
            staffPermissions: getStaffPermissions(user),
          };
        }

        const accessToken = CookieUtils.getCookie(req, "accessToken");

        if (!accessToken) {
          throw new AppError(
            status.UNAUTHORIZED,
            "Unauthorized access! No access token provided.",
          );
        }
      }

      //Access Token Verification
      const accessToken = CookieUtils.getCookie(req, "accessToken");

      if (!accessToken) {
        throw new AppError(
          status.UNAUTHORIZED,
          "Unauthorized access! No access token provided.",
        );
      }

      const verifiedToken = jwtUtils.verifyToken(
        accessToken,
        envVars.ACCESS_TOKEN_SECRET,
      );

      if (!verifiedToken.success) {
        throw new AppError(
          status.UNAUTHORIZED,
          "Unauthorized access! Invalid access token.",
        );
      }

      // If req.user is not set by session, verify user in database
      if (!req.user) {
        const userExists = await prisma.user.findUnique({
          where: { id: verifiedToken.data!.userId },
          include: staffRoleInclude,
        });

        if (
          !userExists ||
          userExists.isDeleted ||
          userExists.status === UserStatus.BLOCKED ||
          userExists.status === UserStatus.DELETED
        ) {
          throw new AppError(
            status.UNAUTHORIZED,
            "Unauthorized access! User no longer exists or is inactive.",
          );
        }

        req.user = {
          userId: userExists.id,
          role: userExists.role,
          email: userExists.email,
          staffPermissions: getStaffPermissions(userExists),
        };
      }

      if (
        authRoles.length > 0 &&
        !authRoles.includes(req.user.role as Role)
      ) {
        throw new AppError(
          status.FORBIDDEN,
          "Forbidden access! You do not have permission to access this resource.",
        );
      }

      // Staff only reach the parts of the dashboard their role allows
      if (req.user.staffPermissions) {
        const path = req.originalUrl.split("?")[0].replace(/^\/api\/v1/, "");
        const rule = requiredStaffPermission(path, req.method);
        if (!hasStaffPermission(req.user.staffPermissions, rule)) {
          throw new AppError(
            status.FORBIDDEN,
            "Your role does not have access to this section.",
          );
        }
      }

      next();
    } catch (error: any) {
      next(error);
    }
  };

// For routes open to guests: sets req.user when a valid login is present,
// otherwise (no or stale cookies) the request continues as a guest
export const optionalAuth =
  () => (req: Request, res: Response, next: NextFunction) =>
    checkAuth()(req, res, (error?: any) => {
      if (error) req.user = undefined as any;
      next();
    });
