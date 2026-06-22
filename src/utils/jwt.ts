import "dotenv/config";
import jwt, { type JwtPayload, type Secret, type SignOptions } from "jsonwebtoken";
import type { Role } from "@prisma/client";

export type TokenPayload = {
  id: number;
  email: string;
  role: Role;
};

export type DecodedToken = TokenPayload & JwtPayload;

const getJwtSecret = (): Secret => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET belum diisi di file .env");
  }

  return secret;
};

const getJwtExpiresIn = (): SignOptions["expiresIn"] => {
  return (process.env.JWT_EXPIRES_IN || "7d") as SignOptions["expiresIn"];
};

export const generateToken = (payload: TokenPayload): string => {
  const options: SignOptions = {
    expiresIn: getJwtExpiresIn(),
  };

  return jwt.sign(payload, getJwtSecret(), options);
};

export const verifyToken = (token: string): DecodedToken => {
  const decoded = jwt.verify(token, getJwtSecret());

  if (typeof decoded === "string") {
    throw new Error("Token tidak valid");
  }

  return decoded as DecodedToken;
};

export const extractTokenFromHeader = (
  authorizationHeader?: string
): string | null => {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
};