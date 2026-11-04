import status from "http-status";
import { Prisma } from "../../generated/prisma/client";
import { TErrorResponse, TErrorSources } from "../interfaces/error.interface";

const getStatusCodeFromPrismaError = (errorCode: string): number => {
  //P2002: Unique constraint failed
  if (errorCode === "P2002") {
    return status.CONFLICT;
  }

  // P2025, P2001, P2015, P2018 : Not Found errors
  if (["P2025", "P2001", "P2015", "P2018"].includes(errorCode)) {
    return status.NOT_FOUND;
  }

  // P1000 , P6002 : DB Authentication errors = 401 Unauthorized
  if (["P1000", "P6002"].includes(errorCode)) {
    return status.UNAUTHORIZED;
  }

  // P1010 , P6010 : Access denied errors = 403 Forbidden
  if (["P1010", "P6010"].includes(errorCode)) {
    return status.FORBIDDEN;
  }

  // P6003 : Prisma Accelararate Plan limit exceeded = 402 Payment Required
  if (errorCode === "P6003") {
    return status.PAYMENT_REQUIRED;
  }

  // P1008, 2004, 6004 : Timeout errors = 504 Gateway Timeout
  if (["P1008", "P2004", "P6004"].includes(errorCode)) {
    return status.GATEWAY_TIMEOUT;
  }

  // P5011 : Rate Limit Exceeded = 429 Too Many Requests
  if (errorCode === "P5011") {
    return status.TOO_MANY_REQUESTS;
  }

  // P6009 Response size limit exceeded = 413 Payload Too Large
  if (errorCode === "P6009") {
    return 413;
  }

  // P1xxx , P2024, P2037, P6008 : Connection errors
  if (
    errorCode.startsWith("P1") ||
    ["P2024", "P2037", "P6008"].includes(errorCode)
  ) {
    return status.SERVICE_UNAVAILABLE;
  }

  // P2XXX : except unhandled errors, Bad Request
  if (errorCode.startsWith("P2")) {
    return status.BAD_REQUEST;
  }

  // P3XXX, P4XXX : Internal Server Errors
  if (errorCode.startsWith("P3") || errorCode.startsWith("P4")) {
    return status.INTERNAL_SERVER_ERROR;
  }

  return status.INTERNAL_SERVER_ERROR;
};

// Prisma error messages look like:
//   Invalid `prisma.x.create()` invocation in
//   E:\...\file.ts:161:34
//     158 ...code frame...
//   → 161 return prisma.x.create(
//   The column `discount of relation wholesale_requests` does not exist ...
// The useful reason is the LAST non-empty line, not the first.
const extractPrismaReason = (message: string, fallback: string): string => {
  const lines = message
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines[lines.length - 1] || fallback;
};

type TPrismaDetails = {
  model?: string;
  table?: string;
  fields: string[];
  constraint?: string;
};

// Collect model / table / column / field names from meta (Prisma 7 driver
// adapters put them under meta.driverAdapterError.cause) and from the message.
const extractPrismaDetails = (
  error: Prisma.PrismaClientKnownRequestError,
): TPrismaDetails => {
  const meta = (error.meta ?? {}) as Record<string, unknown>;
  const cause = (meta.driverAdapterError as { cause?: Record<string, unknown> } | undefined)
    ?.cause;

  const details: TPrismaDetails = {
    model: (meta.modelName ?? meta.model_name) as string | undefined,
    table: meta.table as string | undefined,
    fields: [],
  };

  const addFields = (value: unknown) => {
    if (!value) return;
    const list = Array.isArray(value) ? value : [value];
    for (const v of list) {
      const name = String(v);
      if (name && !details.fields.includes(name)) details.fields.push(name);
    }
  };

  addFields(meta.target);
  addFields(meta.field_name);
  addFields(meta.column_name);
  addFields(meta.column);
  addFields(meta.argument_name);
  if (meta.constraint) details.constraint = String(meta.constraint);

  if (cause) {
    addFields(cause.column);
    if (cause.table && !details.table) details.table = String(cause.table);
    const constraint = cause.constraint as
      | { fields?: string[]; index?: string }
      | undefined;
    addFields(constraint?.fields);
    if (constraint?.index) details.constraint = constraint.index;
  }

  // "The column `discount of relation wholesale_requests` does not exist"
  const columnMatch = error.message.match(/column `([^`]+?)(?: of relation ([^`]+))?` does not exist/i);
  if (columnMatch) {
    details.fields = details.fields.filter((f) => !f.includes(" of relation "));
    addFields(columnMatch[1]);
    if (columnMatch[2] && !details.table) details.table = columnMatch[2];
  }

  // "The table `public.xyz` does not exist"
  const tableMatch = error.message.match(/table `([^`]+)` does not exist/i);
  if (tableMatch && !details.table) details.table = tableMatch[1];

  return details;
};

const describeLocation = (d: TPrismaDetails): string => {
  const parts: string[] = [];
  if (d.fields.length) parts.push(`field: ${d.fields.join(", ")}`);
  if (d.model) parts.push(`model: ${d.model}`);
  if (d.table) parts.push(`table: ${d.table}`);
  if (d.constraint) parts.push(`constraint: ${d.constraint}`);
  return parts.join(" | ");
};

const fieldList = (d: TPrismaDetails, fallback = "unknown field") =>
  d.fields.length ? d.fields.map((f) => `\`${f}\``).join(", ") : fallback;

// A short sentence that says what went wrong and where, per error code.
const buildKnownErrorMessage = (
  error: Prisma.PrismaClientKnownRequestError,
  d: TPrismaDetails,
  reason: string,
): string => {
  const where = d.model ? ` on ${d.model}` : "";

  switch (error.code) {
    case "P2002":
      return `Duplicate value${where}: ${fieldList(d)} must be unique`;
    case "P2003":
      return `Related record not found${where} (foreign key ${fieldList(d, d.constraint ?? "unknown")})`;
    case "P2011":
      return `Required value missing${where}: ${fieldList(d)} cannot be null`;
    case "P2000":
      return `Value too long${where} for ${fieldList(d)}`;
    case "P2025":
      return `Record not found${where}: ${reason}`;
    case "P2021":
      return `Database table ${d.table ? `\`${d.table}\`` : ""} does not exist${where} — run pending migrations (prisma migrate deploy)`;
    case "P2022":
      return `Database column ${fieldList(d)}${d.table ? ` (table ${d.table})` : ""} does not exist${where} — run pending migrations (prisma migrate deploy)`;
    default: {
      const location = describeLocation(d);
      return location ? `${reason} [${location}]` : reason;
    }
  }
};

export const handlePrismaClientKnownRequestError = (
  error: Prisma.PrismaClientKnownRequestError,
): TErrorResponse => {
  const statusCode = getStatusCodeFromPrismaError(error.code);
  const reason = extractPrismaReason(
    error.message,
    "An error occurred with the database operation.",
  );
  const details = extractPrismaDetails(error);
  const message = buildKnownErrorMessage(error, details, reason);

  const errorSources: TErrorSources[] = details.fields.length
    ? details.fields.map((field) => ({ path: field, message }))
    : [{ path: details.model ?? error.code, message }];

  errorSources.push({ path: "prismaCode", message: `${error.code}: ${reason}` });

  return {
    success: false,
    statusCode,
    message,
    errorSources,
  };
};

export const handlePrismaClientUnknownError = (
  error: Prisma.PrismaClientUnknownRequestError,
): TErrorResponse => {
  const reason = extractPrismaReason(
    error.message,
    "An unknown error occurred with the database operation.",
  );

  return {
    success: false,
    statusCode: status.INTERNAL_SERVER_ERROR,
    message: `Database error: ${reason}`,
    errorSources: [{ path: "database", message: reason }],
  };
};

export const handlePrismaClientValidationError = (
  error: Prisma.PrismaClientValidationError,
): TErrorResponse => {
  // e.g. "Argument `quantity`: Invalid value provided. Expected Int, provided String."
  //      "Argument `name` is missing."
  //      "Unknown argument `discount`. Available options are marked with ?."
  const reason = extractPrismaReason(
    error.message,
    "Invalid data sent to the database.",
  );

  const fieldMatch =
    reason.match(/argument `([\w.]+)`/i) ??
    error.message.match(/argument `([\w.]+)`/i) ??
    error.message.match(/field `([\w.]+)`/i);
  const field = fieldMatch?.[1];

  const operation = error.message.match(/`(prisma\.\w+\.\w+)\(\)`/)?.[1];

  const message = `Invalid database input${field ? ` for \`${field}\`` : ""}${
    operation ? ` in ${operation}()` : ""
  }: ${reason}`;

  return {
    success: false,
    statusCode: status.BAD_REQUEST,
    message,
    errorSources: [{ path: field ?? "unknown", message: reason }],
  };
};

export const handlerPrismaClientInitializationError = (
  error: Prisma.PrismaClientInitializationError,
): TErrorResponse => {
  const statusCode = error.errorCode
    ? getStatusCodeFromPrismaError(error.errorCode)
    : status.SERVICE_UNAVAILABLE;

  const mainMessage = extractPrismaReason(
    error.message,
    "An error occurred while initializing the Prisma Client.",
  );

  const errorSources: TErrorSources[] = [
    {
      path: error.errorCode || "Initialization Error",
      message: mainMessage,
    },
  ];

  return {
    success: false,
    statusCode,
    message: `Prisma Client Initialization Error: ${mainMessage}`,
    errorSources,
  };
};

export const handlerPrismaClientRustPanicError = (): TErrorResponse => {
  const errorSources: TErrorSources[] = [
    {
      path: "Rust Engine Crashed",
      message:
        "The database engine encountered a fatal error and crashed. This is usually due to an internal bug in the Prisma engine or an unexpected edge case in the database operation. Please check the Prisma logs for more details and consider reporting this issue to the Prisma team if it persists.",
    },
  ];

  return {
    success: false,
    statusCode: status.INTERNAL_SERVER_ERROR,
    message:
      "Prisma Client Rust Panic Error: The database engine crashed due to a fatal error.",
    errorSources,
  };
};
