import { Router } from "express";
import { Role } from "@prisma/client";
import {
  createApplicationReview,
  createProductReview,
  deleteMyApplicationReview,
  deleteMyProductReview,
  getApplicationReviews,
  getMyApplicationReviews,
  getMyProductReviews,
  getProductReviews,
  updateMyApplicationReview,
  updateMyProductReview,
} from "../controllers/review.controller";
import {
  authMiddleware,
  authorizeRoles,
} from "../middleware/auth.middleware";

const router = Router();

/**
 * @swagger
 * /api/reviews/products/my:
 *   get:
 *     summary: Ambil review produk milik user login
 *     tags: [Reviews]
 *     description: Mengambil daftar review produk yang pernah dibuat oleh user yang sedang login.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 10
 *     responses:
 *       200:
 *         description: Data review produk milik user berhasil diambil
 *       401:
 *         description: Token tidak valid atau user belum login
 */
router.get("/products/my", authMiddleware, getMyProductReviews);

/**
 * @swagger
 * /api/reviews/products/{productId}:
 *   get:
 *     summary: Ambil review produk
 *     tags: [Reviews]
 *     description: Mengambil daftar review dari sebuah produk secara public.
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 10
 *     responses:
 *       200:
 *         description: Data review produk berhasil diambil
 *       404:
 *         description: Produk tidak ditemukan
 */
router.get("/products/:productId", getProductReviews);

/**
 * @swagger
 * /api/reviews/products/{productId}:
 *   post:
 *     summary: Buat review produk
 *     tags: [Reviews]
 *     description: User membuat review produk. Komentar akan disanitasi agar input berbahaya tidak dieksekusi di halaman.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateProductReviewRequest'
 *     responses:
 *       201:
 *         description: Review produk berhasil dibuat
 *       400:
 *         description: Rating atau komentar tidak valid
 *       401:
 *         description: Token tidak valid atau user belum login
 *       403:
 *         description: Role tidak memiliki izin
 *       404:
 *         description: Produk tidak ditemukan
 *       409:
 *         description: User sudah pernah memberi review untuk produk ini
 */
router.post(
  "/products/:productId",
  authMiddleware,
  authorizeRoles(Role.USER, Role.SELLER),
  createProductReview
);

/**
 * @swagger
 * /api/reviews/products/{id}:
 *   patch:
 *     summary: Update review produk milik user login
 *     tags: [Reviews]
 *     description: User mengubah review produk miliknya sendiri.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *         description: ID review produk
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateProductReviewRequest'
 *     responses:
 *       200:
 *         description: Review produk berhasil diperbarui
 *       400:
 *         description: Data input tidak valid
 *       401:
 *         description: Token tidak valid atau user belum login
 *       403:
 *         description: Role tidak memiliki izin
 *       404:
 *         description: Review produk tidak ditemukan
 */
router.patch(
  "/products/:id",
  authMiddleware,
  authorizeRoles(Role.USER, Role.SELLER),
  updateMyProductReview
);

/**
 * @swagger
 * /api/reviews/products/{id}:
 *   delete:
 *     summary: Hapus review produk milik user login
 *     tags: [Reviews]
 *     description: User menghapus review produk miliknya sendiri.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *         description: ID review produk
 *     responses:
 *       200:
 *         description: Review produk berhasil dihapus
 *       401:
 *         description: Token tidak valid atau user belum login
 *       403:
 *         description: Role tidak memiliki izin
 *       404:
 *         description: Review produk tidak ditemukan
 */
router.delete(
  "/products/:id",
  authMiddleware,
  authorizeRoles(Role.USER, Role.SELLER),
  deleteMyProductReview
);

/**
 * @swagger
 * /api/reviews/app/my:
 *   get:
 *     summary: Ambil review aplikasi milik user login
 *     tags: [Reviews]
 *     description: Mengambil daftar review aplikasi SEAPEDIA yang dibuat oleh user yang sedang login.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 10
 *     responses:
 *       200:
 *         description: Data review aplikasi milik user berhasil diambil
 *       401:
 *         description: Token tidak valid atau user belum login
 */
router.get("/app/my", authMiddleware, getMyApplicationReviews);

/**
 * @swagger
 * /api/reviews/app:
 *   get:
 *     summary: Ambil semua review aplikasi
 *     tags: [Reviews]
 *     description: Mengambil daftar review aplikasi SEAPEDIA secara public.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 10
 *     responses:
 *       200:
 *         description: Data review aplikasi berhasil diambil
 */
router.get("/app", getApplicationReviews);

/**
 * @swagger
 * /api/reviews/app:
 *   post:
 *     summary: Buat review aplikasi
 *     tags: [Reviews]
 *     description: User membuat review untuk aplikasi SEAPEDIA. Komentar akan disanitasi agar aman.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateApplicationReviewRequest'
 *     responses:
 *       201:
 *         description: Review aplikasi berhasil dibuat
 *       400:
 *         description: Rating atau komentar tidak valid
 *       401:
 *         description: Token tidak valid atau user belum login
 */
router.post("/app", authMiddleware, createApplicationReview);

/**
 * @swagger
 * /api/reviews/app/{id}:
 *   patch:
 *     summary: Update review aplikasi milik user login
 *     tags: [Reviews]
 *     description: User mengubah review aplikasi miliknya sendiri.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *         description: ID review aplikasi
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateApplicationReviewRequest'
 *     responses:
 *       200:
 *         description: Review aplikasi berhasil diperbarui
 *       400:
 *         description: Data input tidak valid
 *       401:
 *         description: Token tidak valid atau user belum login
 *       404:
 *         description: Review aplikasi tidak ditemukan
 */
router.patch("/app/:id", authMiddleware, updateMyApplicationReview);

/**
 * @swagger
 * /api/reviews/app/{id}:
 *   delete:
 *     summary: Hapus review aplikasi milik user login
 *     tags: [Reviews]
 *     description: User menghapus review aplikasi miliknya sendiri.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *         description: ID review aplikasi
 *     responses:
 *       200:
 *         description: Review aplikasi berhasil dihapus
 *       401:
 *         description: Token tidak valid atau user belum login
 *       404:
 *         description: Review aplikasi tidak ditemukan
 */
router.delete("/app/:id", authMiddleware, deleteMyApplicationReview);

export default router;