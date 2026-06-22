"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMiddleware = exports.notFoundMiddleware = exports.AppError = void 0;
const client_1 = require("@prisma/client");
class AppError extends Error {
    constructor(message, statusCode = 500, details) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
const notFoundMiddleware = (req, _res, next) => {
    next(new AppError(`Route ${req.originalUrl} tidak ditemukan.`, 404));
};
exports.notFoundMiddleware = notFoundMiddleware;
const handlePrismaError = (error) => {
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
const errorMiddleware = (error, _req, res, _next) => {
    let handledError;
    if (error instanceof AppError) {
        handledError = error;
    }
    else if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        handledError = handlePrismaError(error);
    }
    else if (error instanceof SyntaxError && "body" in error) {
        handledError = new AppError("Format JSON tidak valid.", 400);
    }
    else {
        handledError = new AppError(error instanceof Error ? error.message : "Internal server error.", 500);
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
exports.errorMiddleware = errorMiddleware;
