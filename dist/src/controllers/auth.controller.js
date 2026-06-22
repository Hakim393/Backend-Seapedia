"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.changePassword = exports.updateProfile = exports.getProfile = exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../config/prisma"));
const error_middleware_1 = require("../middleware/error.middleware");
const jwt_1 = require("../utils/jwt");
const sanitize_1 = require("../utils/sanitize");
const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};
const isValidRole = (role) => {
    return typeof role === "string" && Object.values(client_1.Role).includes(role);
};
const getSafeUserSelect = {
    id: true,
    name: true,
    email: true,
    role: true,
    phone: true,
    address: true,
    createdAt: true,
    updatedAt: true,
};
const register = async (req, res, next) => {
    try {
        const { name, email, password, role, phone, address } = req.body;
        const cleanName = (0, sanitize_1.sanitizeText)(name, {
            maxLength: 100,
            trim: true,
            allowNewLines: false,
        });
        const cleanEmail = String(email || "").trim().toLowerCase();
        const cleanPhone = (0, sanitize_1.sanitizeNullableText)(phone, {
            maxLength: 30,
            trim: true,
            allowNewLines: false,
        });
        const cleanAddress = (0, sanitize_1.sanitizeNullableText)(address, {
            maxLength: 500,
            trim: true,
            allowNewLines: true,
        });
        if (!cleanName) {
            throw new error_middleware_1.AppError("Nama wajib diisi.", 400);
        }
        if (!cleanEmail) {
            throw new error_middleware_1.AppError("Email wajib diisi.", 400);
        }
        if (!isValidEmail(cleanEmail)) {
            throw new error_middleware_1.AppError("Format email tidak valid.", 400);
        }
        if (!password) {
            throw new error_middleware_1.AppError("Password wajib diisi.", 400);
        }
        if (String(password).length < 6) {
            throw new error_middleware_1.AppError("Password minimal 6 karakter.", 400);
        }
        const selectedRole = role ? role : client_1.Role.USER;
        if (!isValidRole(selectedRole)) {
            throw new error_middleware_1.AppError("Role tidak valid.", 400);
        }
        const existingUser = await prisma_1.default.user.findUnique({
            where: {
                email: cleanEmail,
            },
            select: {
                id: true,
            },
        });
        if (existingUser) {
            throw new error_middleware_1.AppError("Email sudah digunakan.", 409);
        }
        const passwordHash = await bcryptjs_1.default.hash(String(password), 10);
        const user = await prisma_1.default.user.create({
            data: {
                name: cleanName,
                email: cleanEmail,
                passwordHash,
                role: selectedRole,
                phone: cleanPhone,
                address: cleanAddress,
            },
            select: getSafeUserSelect,
        });
        const token = (0, jwt_1.generateToken)({
            id: user.id,
            email: user.email,
            role: user.role,
        });
        return res.status(201).json({
            success: true,
            message: "Register berhasil.",
            data: {
                token,
                user,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.register = register;
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const cleanEmail = String(email || "").trim().toLowerCase();
        if (!cleanEmail) {
            throw new error_middleware_1.AppError("Email wajib diisi.", 400);
        }
        if (!password) {
            throw new error_middleware_1.AppError("Password wajib diisi.", 400);
        }
        const user = await prisma_1.default.user.findUnique({
            where: {
                email: cleanEmail,
            },
        });
        if (!user) {
            throw new error_middleware_1.AppError("Email atau password salah.", 401);
        }
        const isPasswordValid = await bcryptjs_1.default.compare(String(password), user.passwordHash);
        if (!isPasswordValid) {
            throw new error_middleware_1.AppError("Email atau password salah.", 401);
        }
        const token = (0, jwt_1.generateToken)({
            id: user.id,
            email: user.email,
            role: user.role,
        });
        return res.status(200).json({
            success: true,
            message: "Login berhasil.",
            data: {
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    phone: user.phone,
                    address: user.address,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt,
                },
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.login = login;
const getProfile = async (req, res, next) => {
    try {
        if (!req.user) {
            throw new error_middleware_1.AppError("Silakan login terlebih dahulu.", 401);
        }
        const user = await prisma_1.default.user.findUnique({
            where: {
                id: req.user.id,
            },
            select: {
                ...getSafeUserSelect,
                store: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        description: true,
                        logoUrl: true,
                        address: true,
                        status: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                },
                cart: {
                    select: {
                        id: true,
                        storeId: true,
                        createdAt: true,
                        updatedAt: true,
                        _count: {
                            select: {
                                items: true,
                            },
                        },
                    },
                },
            },
        });
        if (!user) {
            throw new error_middleware_1.AppError("User tidak ditemukan.", 404);
        }
        return res.status(200).json({
            success: true,
            message: "Profile berhasil diambil.",
            data: user,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getProfile = getProfile;
const updateProfile = async (req, res, next) => {
    try {
        if (!req.user) {
            throw new error_middleware_1.AppError("Silakan login terlebih dahulu.", 401);
        }
        const { name, phone, address } = req.body;
        const updateData = {};
        if (name !== undefined) {
            const cleanName = (0, sanitize_1.sanitizeText)(name, {
                maxLength: 100,
                trim: true,
                allowNewLines: false,
            });
            if (!cleanName) {
                throw new error_middleware_1.AppError("Nama tidak boleh kosong.", 400);
            }
            updateData.name = cleanName;
        }
        if (phone !== undefined) {
            updateData.phone = (0, sanitize_1.sanitizeNullableText)(phone, {
                maxLength: 30,
                trim: true,
                allowNewLines: false,
            });
        }
        if (address !== undefined) {
            updateData.address = (0, sanitize_1.sanitizeNullableText)(address, {
                maxLength: 500,
                trim: true,
                allowNewLines: true,
            });
        }
        const updatedUser = await prisma_1.default.user.update({
            where: {
                id: req.user.id,
            },
            data: updateData,
            select: getSafeUserSelect,
        });
        return res.status(200).json({
            success: true,
            message: "Profile berhasil diperbarui.",
            data: updatedUser,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateProfile = updateProfile;
const changePassword = async (req, res, next) => {
    try {
        if (!req.user) {
            throw new error_middleware_1.AppError("Silakan login terlebih dahulu.", 401);
        }
        const { oldPassword, newPassword, confirmPassword } = req.body;
        if (!oldPassword) {
            throw new error_middleware_1.AppError("Password lama wajib diisi.", 400);
        }
        if (!newPassword) {
            throw new error_middleware_1.AppError("Password baru wajib diisi.", 400);
        }
        if (String(newPassword).length < 6) {
            throw new error_middleware_1.AppError("Password baru minimal 6 karakter.", 400);
        }
        if (newPassword !== confirmPassword) {
            throw new error_middleware_1.AppError("Konfirmasi password tidak sama.", 400);
        }
        const user = await prisma_1.default.user.findUnique({
            where: {
                id: req.user.id,
            },
        });
        if (!user) {
            throw new error_middleware_1.AppError("User tidak ditemukan.", 404);
        }
        const isOldPasswordValid = await bcryptjs_1.default.compare(String(oldPassword), user.passwordHash);
        if (!isOldPasswordValid) {
            throw new error_middleware_1.AppError("Password lama salah.", 401);
        }
        const newPasswordHash = await bcryptjs_1.default.hash(String(newPassword), 10);
        await prisma_1.default.user.update({
            where: {
                id: req.user.id,
            },
            data: {
                passwordHash: newPasswordHash,
            },
        });
        return res.status(200).json({
            success: true,
            message: "Password berhasil diubah.",
        });
    }
    catch (error) {
        next(error);
    }
};
exports.changePassword = changePassword;
const logout = async (_req, res) => {
    return res.status(200).json({
        success: true,
        message: "Logout berhasil. Silakan hapus token dari localStorage/sessionStorage di frontend.",
    });
};
exports.logout = logout;
