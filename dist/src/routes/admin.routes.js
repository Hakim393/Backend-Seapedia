"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const admin_controller_1 = require("../controllers/admin.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.use((0, auth_middleware_1.authorizeRoles)(client_1.Role.ADMIN));
/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Dashboard statistik admin
 *     tags: [Admin]
 *     description: Mengambil ringkasan data SEAPEDIA seperti total user, seller, toko, produk, order, review, revenue, order terbaru, dan produk stok rendah.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Data dashboard admin berhasil diambil
 *       401:
 *         description: Token tidak valid atau belum login
 *       403:
 *         description: Hanya admin yang boleh mengakses endpoint ini
 */
router.get("/dashboard", admin_controller_1.getAdminDashboard);
/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Ambil semua user
 *     tags: [Admin]
 *     description: Mengambil semua user dengan pagination, search, dan filter role.
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
 *           example: fikhi
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [USER, SELLER, ADMIN]
 *           example: USER
 *     responses:
 *       200:
 *         description: Data user berhasil diambil
 */
router.get("/users", admin_controller_1.getAllUsers);
/**
 * @swagger
 * /api/admin/users/{id}:
 *   get:
 *     summary: Ambil detail user
 *     tags: [Admin]
 *     description: Mengambil detail user berdasarkan ID.
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
 *         description: Detail user berhasil diambil
 *       404:
 *         description: User tidak ditemukan
 */
router.get("/users/:id", admin_controller_1.getUserById);
/**
 * @swagger
 * /api/admin/users/{id}/role:
 *   patch:
 *     summary: Update role user
 *     tags: [Admin]
 *     description: Mengubah role user menjadi USER, SELLER, atau ADMIN.
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
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [USER, SELLER, ADMIN]
 *                 example: SELLER
 *     responses:
 *       200:
 *         description: Role user berhasil diperbarui
 *       400:
 *         description: Role tidak valid
 *       404:
 *         description: User tidak ditemukan
 */
router.patch("/users/:id/role", admin_controller_1.updateUserRole);
/**
 * @swagger
 * /api/admin/users/{id}:
 *   delete:
 *     summary: Hapus user
 *     tags: [Admin]
 *     description: Menghapus user berdasarkan ID. Admin tidak bisa menghapus akun sendiri atau admin terakhir.
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
 *         description: User berhasil dihapus
 *       400:
 *         description: User tidak dapat dihapus
 *       404:
 *         description: User tidak ditemukan
 */
router.delete("/users/:id", admin_controller_1.deleteUser);
/**
 * @swagger
 * /api/admin/stores:
 *   get:
 *     summary: Ambil semua toko
 *     tags: [Admin]
 *     description: Mengambil semua toko dengan pagination, search, dan filter status toko.
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
 *           example: toko gadget
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, SUSPENDED]
 *           example: ACTIVE
 *     responses:
 *       200:
 *         description: Data toko berhasil diambil
 */
router.get("/stores", admin_controller_1.getAllStoresForAdmin);
/**
 * @swagger
 * /api/admin/stores/{id}/status:
 *   patch:
 *     summary: Update status toko
 *     tags: [Admin]
 *     description: Mengubah status toko menjadi ACTIVE, INACTIVE, atau SUSPENDED.
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE, SUSPENDED]
 *                 example: SUSPENDED
 *     responses:
 *       200:
 *         description: Status toko berhasil diperbarui
 *       400:
 *         description: Status toko tidak valid
 *       404:
 *         description: Toko tidak ditemukan
 */
router.patch("/stores/:id/status", admin_controller_1.updateStoreStatus);
/**
 * @swagger
 * /api/admin/products:
 *   get:
 *     summary: Ambil semua produk
 *     tags: [Admin]
 *     description: Mengambil semua produk dengan pagination, search, filter status, storeId, dan categoryId.
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
 *         name: storeId
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Data produk berhasil diambil
 */
router.get("/products", admin_controller_1.getAllProductsForAdmin);
/**
 * @swagger
 * /api/admin/products/{id}/status:
 *   patch:
 *     summary: Update status produk
 *     tags: [Admin]
 *     description: Mengubah status produk menjadi ACTIVE, INACTIVE, atau OUT_OF_STOCK.
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE, OUT_OF_STOCK]
 *                 example: INACTIVE
 *     responses:
 *       200:
 *         description: Status produk berhasil diperbarui
 *       400:
 *         description: Status produk tidak valid
 *       404:
 *         description: Produk tidak ditemukan
 */
router.patch("/products/:id/status", admin_controller_1.updateProductStatus);
/**
 * @swagger
 * /api/admin/orders:
 *   get:
 *     summary: Ambil semua pesanan
 *     tags: [Admin]
 *     description: Mengambil semua pesanan dengan pagination dan filter status, paymentStatus, storeId, serta userId.
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [SEDANG_DIKEMAS, MENUNGGU_PENGIRIM, SEDANG_DIKIRIM, PESANAN_SELESAI, DIKEMBALIKAN]
 *           example: SEDANG_DIKEMAS
 *       - in: query
 *         name: paymentStatus
 *         schema:
 *           type: string
 *           enum: [PENDING, PAID, FAILED, REFUNDED]
 *           example: PENDING
 *       - in: query
 *         name: storeId
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Data pesanan berhasil diambil
 */
router.get("/orders", admin_controller_1.getAllOrdersForAdmin);
/**
 * @swagger
 * /api/admin/orders/{id}:
 *   get:
 *     summary: Ambil detail pesanan
 *     tags: [Admin]
 *     description: Mengambil detail pesanan berdasarkan ID, termasuk items dan riwayat status.
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
 *         description: Detail pesanan berhasil diambil
 *       404:
 *         description: Pesanan tidak ditemukan
 */
router.get("/orders/:id", admin_controller_1.getOrderDetailForAdmin);
/**
 * @swagger
 * /api/admin/reviews/products:
 *   get:
 *     summary: Ambil semua review produk
 *     tags: [Admin]
 *     description: Mengambil semua review produk dengan pagination dan filter productId atau userId.
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
 *         name: productId
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Data review produk berhasil diambil
 */
router.get("/reviews/products", admin_controller_1.getAllProductReviewsForAdmin);
/**
 * @swagger
 * /api/admin/reviews/products/{id}:
 *   delete:
 *     summary: Hapus review produk
 *     tags: [Admin]
 *     description: Menghapus review produk berdasarkan ID.
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
 *         description: Review produk berhasil dihapus
 *       404:
 *         description: Review produk tidak ditemukan
 */
router.delete("/reviews/products/:id", admin_controller_1.deleteProductReviewForAdmin);
/**
 * @swagger
 * /api/admin/reviews/app:
 *   get:
 *     summary: Ambil semua review aplikasi
 *     tags: [Admin]
 *     description: Mengambil semua review aplikasi SEAPEDIA dengan pagination dan filter userId.
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
 *         name: userId
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Data review aplikasi berhasil diambil
 */
router.get("/reviews/app", admin_controller_1.getAllApplicationReviewsForAdmin);
/**
 * @swagger
 * /api/admin/reviews/app/{id}:
 *   delete:
 *     summary: Hapus review aplikasi
 *     tags: [Admin]
 *     description: Menghapus review aplikasi berdasarkan ID.
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
 *         description: Review aplikasi berhasil dihapus
 *       404:
 *         description: Review aplikasi tidak ditemukan
 */
router.delete("/reviews/app/:id", admin_controller_1.deleteApplicationReviewForAdmin);
exports.default = router;
