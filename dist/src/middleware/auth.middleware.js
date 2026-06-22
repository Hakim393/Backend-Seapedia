"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuthMiddleware = exports.authorizeRoles = exports.authMiddleware = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const jwt_1 = require("../utils/jwt");
const authMiddleware = async (req, res, next) => {
    try {
        const token = (0, jwt_1.extractTokenFromHeader)(req.headers.authorization);
        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Akses ditolak. Token tidak ditemukan.",
            });
        }
        const decoded = (0, jwt_1.verifyToken)(token);
        const user = await prisma_1.default.user.findUnique({
            where: {
                id: decoded.id,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
            },
        });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Akses ditolak. User tidak ditemukan.",
            });
        }
        req.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
        };
        next();
    }
    catch (error) {
        return res.status(401).json({
            success: false,
            message: "Token tidak valid atau sudah kedaluwarsa.",
        });
    }
};
exports.authMiddleware = authMiddleware;
const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Akses ditolak. Silakan login terlebih dahulu.",
            });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: "Akses ditolak. Role kamu tidak memiliki izin.",
            });
        }
        next();
    };
};
exports.authorizeRoles = authorizeRoles;
const optionalAuthMiddleware = async (req, _res, next) => {
    try {
        const token = (0, jwt_1.extractTokenFromHeader)(req.headers.authorization);
        if (!token) {
            return next();
        }
        const decoded = (0, jwt_1.verifyToken)(token);
        const user = await prisma_1.default.user.findUnique({
            where: {
                id: decoded.id,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
            },
        });
        if (user) {
            req.user = {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            };
        }
        next();
    }
    catch {
        next();
    }
};
exports.optionalAuthMiddleware = optionalAuthMiddleware;
