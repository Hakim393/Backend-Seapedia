import { Router } from "express";
import { Role } from "@prisma/client";
import {
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  getAllProducts,
  getCategories,
  getProductById,
  getProductBySlug,
  getSellerProducts,
  updateCategory,
  updateProduct,
} from "../controllers/product.controller";
import {
  authMiddleware,
  authorizeRoles,
} from "../middleware/auth.middleware";

const router = Router();

/**
 * @swagger
 * /api/products/categories:
 *   get:
 *     summary: Ambil semua kategori produk
 *     tags: [Products]
 *     description: Mengambil daftar kategori produk yang tersedia di SEAPEDIA.
 *     responses:
 *       200:
 *         description: Data kategori berhasil diambil
 */
router.get("/categories", getCategories);

/**
 * @swagger
 * /api/products/categories:
 *   post:
 *     summary: Buat kategori produk
 *     tags: [Products]
 *     description: Admin membuat kategori produk baru.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Elektronik
 *     responses:
 *       201:
 *         description: Kategori berhasil dibuat
 *       400:
 *         description: Nama kategori tidak valid
 *       401:
 *         description: Token tidak valid atau user belum login
 *       403:
 *         description: Hanya admin yang boleh mengakses endpoint ini
 *       409:
 *         description: Nama kategori sudah digunakan
 */
router.post(
  "/categories",
  authMiddleware,
  authorizeRoles(Role.ADMIN),
  createCategory
);

/**
 * @swagger
 * /api/products/categories/{id}:
 *   patch:
 *     summary: Update kategori produk
 *     tags: [Products]
 *     description: Admin mengubah nama kategori produk.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Fashion
 *     responses:
 *       200:
 *         description: Kategori berhasil diperbarui
 *       400:
 *         description: Data input tidak valid
 *       401:
 *         description: Token tidak valid atau user belum login
 *       403:
 *         description: Hanya admin yang boleh mengakses endpoint ini
 *       404:
 *         description: Kategori tidak ditemukan
 *       409:
 *         description: Nama kategori sudah digunakan
 */
router.patch(
  "/categories/:id",
  authMiddleware,
  authorizeRoles(Role.ADMIN),
  updateCategory
);

/**
 * @swagger
 * /api/products/categories/{id}:
 *   delete:
 *     summary: Hapus kategori produk
 *     tags: [Products]
 *     description: Admin menghapus kategori produk berdasarkan ID.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Kategori berhasil dihapus
 *       401:
 *         description: Token tidak valid atau user belum login
 *       403:
 *         description: Hanya admin yang boleh mengakses endpoint ini
 *       404:
 *         description: Kategori tidak ditemukan
 */
router.delete(
  "/categories/:id",
  authMiddleware,
  authorizeRoles(Role.ADMIN),
  deleteCategory
);

/**
 * @swagger
 * /api/products/seller/my-products:
 *   get:
 *     summary: Ambil produk milik seller
 *     tags: [Products]
 *     description: Seller mengambil daftar produk dari tokonya sendiri.
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
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           example: keyboard
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, OUT_OF_STOCK]
 *           example: ACTIVE
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Data produk seller berhasil diambil
 *       401:
 *         description: Token tidak valid atau user belum login
 *       403:
 *         description: Hanya seller yang boleh mengakses endpoint ini
 *       404:
 *         description: Seller belum memiliki toko
 */
router.get(
  "/seller/my-products",
  authMiddleware,
  authorizeRoles(Role.SELLER),
  getSellerProducts
);

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Ambil semua produk public
 *     tags: [Products]
 *     description: Mengambil daftar produk aktif dari toko aktif untuk halaman marketplace public.
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
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           example: keyboard
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: categorySlug
 *         schema:
 *           type: string
 *           example: elektronik
 *       - in: query
 *         name: storeId
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: storeSlug
 *         schema:
 *           type: string
 *           example: toko-gadget-nusantara
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *           example: 100000
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *           example: 1000000
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [latest, oldest, price_asc, price_desc, name_asc]
 *           example: latest
 *     responses:
 *       200:
 *         description: Data produk berhasil diambil
 */
router.get("/", getAllProducts);

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Buat produk baru
 *     tags: [Products]
 *     description: Seller membuat produk baru untuk tokonya sendiri.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateProductRequest'
 *     responses:
 *       201:
 *         description: Produk berhasil dibuat
 *       400:
 *         description: Data produk tidak valid
 *       401:
 *         description: Token tidak valid atau user belum login
 *       403:
 *         description: Hanya seller yang boleh mengakses endpoint ini
 *       404:
 *         description: Seller belum memiliki toko atau kategori tidak ditemukan
 */
router.post("/", authMiddleware, authorizeRoles(Role.SELLER), createProduct);

/**
 * @swagger
 * /api/products/slug/{slug}:
 *   get:
 *     summary: Ambil detail produk berdasarkan slug
 *     tags: [Products]
 *     description: Mengambil detail produk aktif berdasarkan slug produk.
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *           example: keyboard-mechanical-rgb
 *     responses:
 *       200:
 *         description: Detail produk berhasil diambil
 *       400:
 *         description: Slug produk tidak valid
 *       404:
 *         description: Produk tidak ditemukan
 */
router.get("/slug/:slug", getProductBySlug);

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Ambil detail produk berdasarkan ID
 *     tags: [Products]
 *     description: Mengambil detail produk aktif berdasarkan ID produk.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Detail produk berhasil diambil
 *       400:
 *         description: Product ID tidak valid
 *       404:
 *         description: Produk tidak ditemukan
 */
router.get("/:id", getProductById);

/**
 * @swagger
 * /api/products/{id}:
 *   patch:
 *     summary: Update produk
 *     tags: [Products]
 *     description: Seller mengubah produk milik tokonya sendiri.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProductRequest'
 *     responses:
 *       200:
 *         description: Produk berhasil diperbarui
 *       400:
 *         description: Data input tidak valid
 *       401:
 *         description: Token tidak valid atau user belum login
 *       403:
 *         description: Hanya seller yang boleh mengakses endpoint ini
 *       404:
 *         description: Produk tidak ditemukan atau bukan milik toko seller
 */
router.patch("/:id", authMiddleware, authorizeRoles(Role.SELLER), updateProduct);

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Hapus produk
 *     tags: [Products]
 *     description: Seller menghapus produk milik tokonya sendiri.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Produk berhasil dihapus
 *       401:
 *         description: Token tidak valid atau user belum login
 *       403:
 *         description: Hanya seller yang boleh mengakses endpoint ini
 *       404:
 *         description: Produk tidak ditemukan atau bukan milik toko seller
 */
router.delete("/:id", authMiddleware, authorizeRoles(Role.SELLER), deleteProduct);

export default router;