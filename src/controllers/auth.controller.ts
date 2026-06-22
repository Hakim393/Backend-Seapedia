import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import prisma from "../config/prisma";
import { AppError } from "../middleware/error.middleware";
import { generateToken } from "../utils/jwt";
import { sanitizeNullableText, sanitizeText } from "../utils/sanitize";

const isValidEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const isValidRole = (role: unknown): role is Role => {
  return typeof role === "string" && Object.values(Role).includes(role as Role);
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

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, email, password, role, phone, address } = req.body;

    const cleanName = sanitizeText(name, {
      maxLength: 100,
      trim: true,
      allowNewLines: false,
    });

    const cleanEmail = String(email || "").trim().toLowerCase();

    const cleanPhone = sanitizeNullableText(phone, {
      maxLength: 30,
      trim: true,
      allowNewLines: false,
    });

    const cleanAddress = sanitizeNullableText(address, {
      maxLength: 500,
      trim: true,
      allowNewLines: true,
    });

    if (!cleanName) {
      throw new AppError("Nama wajib diisi.", 400);
    }

    if (!cleanEmail) {
      throw new AppError("Email wajib diisi.", 400);
    }

    if (!isValidEmail(cleanEmail)) {
      throw new AppError("Format email tidak valid.", 400);
    }

    if (!password) {
      throw new AppError("Password wajib diisi.", 400);
    }

    if (String(password).length < 6) {
      throw new AppError("Password minimal 6 karakter.", 400);
    }

    const selectedRole = role ? role : Role.USER;

    if (!isValidRole(selectedRole)) {
      throw new AppError("Role tidak valid.", 400);
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email: cleanEmail,
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      throw new AppError("Email sudah digunakan.", 409);
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    const user = await prisma.user.create({
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

    const token = generateToken({
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
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;

    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!cleanEmail) {
      throw new AppError("Email wajib diisi.", 400);
    }

    if (!password) {
      throw new AppError("Password wajib diisi.", 400);
    }

    const user = await prisma.user.findUnique({
      where: {
        email: cleanEmail,
      },
    });

    if (!user) {
      throw new AppError("Email atau password salah.", 401);
    }

    const isPasswordValid = await bcrypt.compare(
      String(password),
      user.passwordHash
    );

    if (!isPasswordValid) {
      throw new AppError("Email atau password salah.", 401);
    }

    const token = generateToken({
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
  } catch (error) {
    next(error);
  }
};

export const getProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new AppError("Silakan login terlebih dahulu.", 401);
    }

    const user = await prisma.user.findUnique({
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
      throw new AppError("User tidak ditemukan.", 404);
    }

    return res.status(200).json({
      success: true,
      message: "Profile berhasil diambil.",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new AppError("Silakan login terlebih dahulu.", 401);
    }

    const { name, phone, address } = req.body;

    const updateData: {
      name?: string;
      phone?: string | null;
      address?: string | null;
    } = {};

    if (name !== undefined) {
      const cleanName = sanitizeText(name, {
        maxLength: 100,
        trim: true,
        allowNewLines: false,
      });

      if (!cleanName) {
        throw new AppError("Nama tidak boleh kosong.", 400);
      }

      updateData.name = cleanName;
    }

    if (phone !== undefined) {
      updateData.phone = sanitizeNullableText(phone, {
        maxLength: 30,
        trim: true,
        allowNewLines: false,
      });
    }

    if (address !== undefined) {
      updateData.address = sanitizeNullableText(address, {
        maxLength: 500,
        trim: true,
        allowNewLines: true,
      });
    }

    const updatedUser = await prisma.user.update({
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
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new AppError("Silakan login terlebih dahulu.", 401);
    }

    const { oldPassword, newPassword, confirmPassword } = req.body;

    if (!oldPassword) {
      throw new AppError("Password lama wajib diisi.", 400);
    }

    if (!newPassword) {
      throw new AppError("Password baru wajib diisi.", 400);
    }

    if (String(newPassword).length < 6) {
      throw new AppError("Password baru minimal 6 karakter.", 400);
    }

    if (newPassword !== confirmPassword) {
      throw new AppError("Konfirmasi password tidak sama.", 400);
    }

    const user = await prisma.user.findUnique({
      where: {
        id: req.user.id,
      },
    });

    if (!user) {
      throw new AppError("User tidak ditemukan.", 404);
    }

    const isOldPasswordValid = await bcrypt.compare(
      String(oldPassword),
      user.passwordHash
    );

    if (!isOldPasswordValid) {
      throw new AppError("Password lama salah.", 401);
    }

    const newPasswordHash = await bcrypt.hash(String(newPassword), 10);

    await prisma.user.update({
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
  } catch (error) {
    next(error);
  }
};

export const logout = async (_req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    message:
      "Logout berhasil. Silakan hapus token dari localStorage/sessionStorage di frontend.",
  });
};