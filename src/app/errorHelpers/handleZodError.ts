import status from "http-status";
import z from "zod";
import { TErrorResponse, TErrorSources } from "../interfaces/error.interface";

// ["items", 0, "quantity"] -> "items[0].quantity"
const formatPath = (path: PropertyKey[]): string =>
  path.reduce<string>((acc, key) => {
    if (typeof key === "number") return `${acc}[${key}]`;
    const name = String(key);
    return acc ? `${acc}.${name}` : name;
  }, "");

export const handleZodError = (err: z.ZodError): TErrorResponse => {
  const errorSources: TErrorSources[] = err.issues.map((issue) => ({
    path: formatPath(issue.path) || "body",
    message: issue.message,
  }));

  // The frontend only shows `message`, so put every field + reason in it,
  // e.g. "Validation failed — phone: Invalid phone number; items[0].quantity: Too small"
  const details = errorSources.map((s) => `${s.path}: ${s.message}`).join("; ");

  return {
    success: false,
    statusCode: status.BAD_REQUEST,
    message: details ? `Validation failed — ${details}` : "Validation failed",
    errorSources,
  };
};
