import { Router } from "express";
import {
  changePassword,
  getProfile,
  login,
  logout,
  register,
  updateProfile,
} from "../controllers/auth.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register akun baru
 *     tags: [Auth]
 *     description: Membuat akun baru di SEAPEDIA. Role yang tersedia adalah USER, SELLER, dan ADMIN.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Register berhasil
 *       400:
 *         description: Data input tidak valid
 *       409:
 *         description: Email sudah digunakan
 */
router.post("/register", register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     description: Login menggunakan email dan password, lalu sistem mengembalikan JWT token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login berhasil
 *       400:
 *         description: Data input tidak valid
 *       401:
 *         description: Email atau password salah
 */
router.post("/login", login);

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: Ambil profile user login
 *     tags: [Auth]
 *     description: Mengambil data profile user berdasarkan JWT token.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile berhasil diambil
 *       401:
 *         description: Token tidak valid atau user belum login
 *       404:
 *         description: User tidak ditemukan
 */
router.get("/profile", authMiddleware, getProfile);

/**
 * @swagger
 * /api/auth/profile:
 *   patch:
 *     summary: Update profile user login
 *     tags: [Auth]
 *     description: Mengubah data profile user seperti nama, nomor telepon, dan alamat.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Fikhi Hakim
 *               phone:
 *                 type: string
 *                 example: "081234567890"
 *               address:
 *                 type: string
 *                 example: Tangerang, Banten
 *     responses:
 *       200:
 *         description: Profile berhasil diperbarui
 *       400:
 *         description: Data input tidak valid
 *       401:
 *         description: Token tidak valid atau user belum login
 *       404:
 *         description: User tidak ditemukan
 */
router.patch("/profile", authMiddleware, updateProfile);

/**
 * @swagger
 * /api/auth/change-password:
 *   patch:
 *     summary: Ubah password user login
 *     tags: [Auth]
 *     description: Mengubah password user yang sedang login.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - oldPassword
 *               - newPassword
 *               - confirmPassword
 *             properties:
 *               oldPassword:
 *                 type: string
 *                 example: password123
 *               newPassword:
 *                 type: string
 *                 example: password456
 *               confirmPassword:
 *                 type: string
 *                 example: password456
 *     responses:
 *       200:
 *         description: Password berhasil diubah
 *       400:
 *         description: Data input tidak valid
 *       401:
 *         description: Password lama salah atau token tidak valid
 *       404:
 *         description: User tidak ditemukan
 */
router.patch("/change-password", authMiddleware, changePassword);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Auth]
 *     description: Logout user. Karena JWT bersifat stateless, frontend cukup menghapus token dari localStorage/sessionStorage.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout berhasil
 *       401:
 *         description: Token tidak valid atau user belum login
 */
router.post("/logout", authMiddleware, logout);

export default router;