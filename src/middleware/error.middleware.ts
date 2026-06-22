import type {
  ErrorRequestHandler,
  NextFunction,
  Request,
  Response,
} from "express";
import { Prisma } from "@prisma/client";

type ErrorDetails = Record<string, unknown> | unknown[];

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  details?: ErrorDetails;

  constructor(message: string, statusCode = 500, details?: ErrorDetails) {
    super(message);

    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const notFoundMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  next(new AppError(`Route ${req.originalUrl} tidak ditemukan.`, 404));
};

const handlePrismaError = (error: Prisma.PrismaClientKnownRequestError) => {
  switch (error.code) {
    case "P2002":
      return new AppError("Data sudah digunakan atau sudah terdaftar.", 409, {
        target: error.meta?.target,
      });

    case "P2025":
      return new AppError("Data tidak ditemukan.", 404);

    case "P2003":
      return new AppError("Relasi data tidak valid.", 400, {
        field: error.meta?.field_name,
      });

    case "P2014":
      return new AppError("Perubahan data melanggar relasi database.", 400);

    default:
      return new AppError("Terjadi kesalahan pada database.", 500, {
        code: error.code,
      });
  }
};

export const errorMiddleware: ErrorRequestHandler = (
  error,
  _req,
  res,
  _next
) => {
  let handledError: AppError;

  if (error instanceof AppError) {
    handledError = error;
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    handledError = handlePrismaError(error);
  } else if (error instanceof SyntaxError && "body" in error) {
    handledError = new AppError("Format JSON tidak valid.", 400);
  } else {
    handledError = new AppError(
      error instanceof Error ? error.message : "Internal server error.",
      500
    );
  }

  const isDevelopment = process.env.NODE_ENV === "development";

  if (isDevelopment) {
    console.error("ERROR:", error);
  }

  return res.status(handledError.statusCode).json({
    success: false,
    message: handledError.message,
    ...(handledError.details && { details: handledError.details }),
    ...(isDevelopment && {
      stack: handledError.stack,
    }),
  });
};