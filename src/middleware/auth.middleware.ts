import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import prisma from "../config/prisma";
import { extractTokenFromHeader, verifyToken } from "../utils/jwt";

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Akses ditolak. Token tidak ditemukan.",
      });
    }

    const decoded = verifyToken(token);

    const user = await prisma.user.findUnique({
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
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Token tidak valid atau sudah kedaluwarsa.",
    });
  }
};

export const authorizeRoles = (...allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
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

export const optionalAuthMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      return next();
    }

    const decoded = verifyToken(token);

    const user = await prisma.user.findUnique({
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
  } catch {
    next();
  }
};