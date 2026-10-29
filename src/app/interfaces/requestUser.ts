import { Role } from "../../generated/prisma/enums";

export interface IRequestUser {
  userId: string;
  role: Role;
  email: string;
  // Set for staff accounts (an ADMIN with a staff role); undefined = full access
  staffPermissions?: string[];
}
