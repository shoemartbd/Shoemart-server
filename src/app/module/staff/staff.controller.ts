import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { StaffService } from "./staff.service";

const ok = (res: Response, message: string, data: unknown, code = 200) =>
  sendResponse(res, { httpStatusCode: code, success: true, message, data });

const getPermissions = catchAsync(async (req: Request, res: Response) => {
  ok(res, "Permissions retrieved successfully", StaffService.getPermissionCatalog());
});

const getRoles = catchAsync(async (req: Request, res: Response) => {
  ok(res, "Roles retrieved successfully", await StaffService.getRoles());
});

const createRole = catchAsync(async (req: Request, res: Response) => {
  ok(res, "Role created successfully", await StaffService.createRole(req.body), 201);
});

const updateRole = catchAsync(async (req: Request, res: Response) => {
  ok(
    res,
    "Role updated successfully",
    await StaffService.updateRole(req.params.id as string, req.body),
  );
});

const deleteRole = catchAsync(async (req: Request, res: Response) => {
  ok(res, "Role deleted successfully", await StaffService.deleteRole(req.params.id as string));
});

const getStaff = catchAsync(async (req: Request, res: Response) => {
  ok(
    res,
    "Staff retrieved successfully",
    await StaffService.getStaff({
      staffRoleId: req.query.staffRoleId as string | undefined,
      searchTerm: req.query.searchTerm as string | undefined,
    }),
  );
});

const createStaff = catchAsync(async (req: Request, res: Response) => {
  ok(res, "Staff account created successfully", await StaffService.createStaff(req.body), 201);
});

const updateStaff = catchAsync(async (req: Request, res: Response) => {
  ok(
    res,
    "Staff account updated successfully",
    await StaffService.updateStaff(req.params.id as string, req.body),
  );
});

const deleteStaff = catchAsync(async (req: Request, res: Response) => {
  ok(res, "Staff account deleted successfully", await StaffService.deleteStaff(req.params.id as string));
});

export const StaffController = {
  getPermissions,
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  getStaff,
  createStaff,
  updateStaff,
  deleteStaff,
};
