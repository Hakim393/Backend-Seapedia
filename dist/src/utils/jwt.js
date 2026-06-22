"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTokenFromHeader = exports.verifyToken = exports.generateToken = void 0;
require("dotenv/config");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET belum diisi di file .env");
    }
    return secret;
};
const getJwtExpiresIn = () => {
    return (process.env.JWT_EXPIRES_IN || "7d");
};
const generateToken = (payload) => {
    const options = {
        expiresIn: getJwtExpiresIn(),
    };
    return jsonwebtoken_1.default.sign(payload, getJwtSecret(), options);
};
exports.generateToken = generateToken;
const verifyToken = (token) => {
    const decoded = jsonwebtoken_1.default.verify(token, getJwtSecret());
    if (typeof decoded === "string") {
        throw new Error("Token tidak valid");
    }
    return decoded;
};
exports.verifyToken = verifyToken;
const extractTokenFromHeader = (authorizationHeader) => {
    if (!authorizationHeader) {
        return null;
    }
    const [scheme, token] = authorizationHeader.split(" ");
    if (scheme !== "Bearer" || !token) {
        return null;
    }
    return token;
};
exports.extractTokenFromHeader = extractTokenFromHeader;
