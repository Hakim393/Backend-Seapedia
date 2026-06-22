"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const order_controller_1 = require("../controllers/order.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
/**
 * @swagger
 * /api/orders/checkout:
 *   post:
 *     summary: Checkout cart menjadi pesanan
 *     tags: [Orders]
 *     description: Membuat order dari isi cart user. Cart wajib berisi produk dari satu toko saja sesuai single-store checkout rule SEAPEDIA.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CheckoutRequest'
 *     responses:
 *       201:
 *         description: Checkout berhasil dan pesanan dibuat
 *       400:
 *         description: Cart kosong, stok tidak cukup, atau cart berisi produk dari toko berbeda
 *       401:
 *         description: Token tidak valid atau user belum login
 *       403:
 *         description: Role tidak memiliki izin checkout
 */
router.post("/checkout", (0, auth_middleware_1.authorizeRoles)(client_1.Role.USER, client_1.Role.SELLER), order_controller_1.checkout);
/**
 * @swagger
 * /api/orders/my-orders:
 *   get:
 *     summary: Ambil pesanan milik user login
 *     tags: [Orders]
 *     description: Mengambil daftar pesanan milik user yang sedang login.
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
 *     responses:
 *       200:
 *         description: Data pesanan berhasil diambil
 *       401:
 *         description: Token tidak valid atau user belum login
 *       403:
 *         description: Role tidak memiliki izin mengakses pesanan pribadi
 */
router.get("/my-orders", (0, auth_middleware_1.authorizeRoles)(client_1.Role.USER, client_1.Role.SELLER), order_controller_1.getMyOrders);
/**
 * @swagger
 * /api/orders/my-orders/{id}:
 *   get:
 *     summary: Ambil detail pesanan milik user login
 *     tags: [Orders]
 *     description: Mengambil detail pesanan milik user yang sedang login berdasarkan ID pesanan.
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
 *       401:
 *         description: Token tidak valid atau user belum login
 *       403:
 *         description: Role tidak memiliki izin mengakses pesanan pribadi
 *       404:
 *         description: Pesanan tidak ditemukan
 */
router.get("/my-orders/:id", (0, auth_middleware_1.authorizeRoles)(client_1.Role.USER, client_1.Role.SELLER), order_controller_1.getMyOrderDetail);
/**
 * @swagger
 * /api/orders/my-orders/{id}/complete:
 *   patch:
 *     summary: Tandai pesanan sebagai selesai
 *     tags: [Orders]
 *     description: User menandai pesanan miliknya sebagai Pesanan Selesai. Hanya bisa dilakukan jika status pesanan sedang SEDANG_DIKIRIM.
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
 *         description: Pesanan berhasil ditandai selesai
 *       400:
 *         description: Pesanan tidak bisa diselesaikan pada status saat ini
 *       401:
 *         description: Token tidak valid atau user belum login
 *       403:
 *         description: Role tidak memiliki izin menyelesaikan pesanan
 *       404:
 *         description: Pesanan tidak ditemukan
 */
router.patch("/my-orders/:id/complete", (0, auth_middleware_1.authorizeRoles)(client_1.Role.USER, client_1.Role.SELLER), order_controller_1.markMyOrderAsCompleted);
/**
 * @swagger
 * /api/orders/my-orders/{id}/return:
 *   patch:
 *     summary: Ajukan pengembalian pesanan
 *     tags: [Orders]
 *     description: User mengajukan pengembalian pesanan miliknya. Status akan berubah menjadi DIKEMBALIKAN.
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
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 example: Produk tidak sesuai pesanan.
 *     responses:
 *       200:
 *         description: Pesanan berhasil diajukan sebagai dikembalikan
 *       400:
 *         description: Pesanan tidak bisa dikembalikan pada status saat ini
 *       401:
 *         description: Token tidak valid atau user belum login
 *       403:
 *         description: Role tidak memiliki izin mengajukan pengembalian
 *       404:
 *         description: Pesanan tidak ditemukan
 */
router.patch("/my-orders/:id/return", (0, auth_middleware_1.authorizeRoles)(client_1.Role.USER, client_1.Role.SELLER), order_controller_1.requestReturnOrder);
/**
 * @swagger
 * /api/orders/seller:
 *   get:
 *     summary: Ambil pesanan masuk toko seller
 *     tags: [Orders]
 *     description: Seller mengambil daftar pesanan yang masuk ke tokonya.
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
 *     responses:
 *       200:
 *         description: Data pesanan toko berhasil diambil
 *       401:
 *         description: Token tidak valid atau user belum login
 *       403:
 *         description: Hanya seller yang boleh mengakses endpoint ini
 *       404:
 *         description: Seller belum memiliki toko
 */
router.get("/seller", (0, auth_middleware_1.authorizeRoles)(client_1.Role.SELLER), order_controller_1.getSellerOrders);
/**
 * @swagger
 * /api/orders/seller/{id}:
 *   get:
 *     summary: Ambil detail pesanan toko seller
 *     tags: [Orders]
 *     description: Seller mengambil detail pesanan yang masuk ke tokonya berdasarkan ID pesanan.
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
 *         description: Detail pesanan toko berhasil diambil
 *       401:
 *         description: Token tidak valid atau user belum login
 *       403:
 *         description: Hanya seller yang boleh mengakses endpoint ini
 *       404:
 *         description: Pesanan tidak ditemukan
 */
router.get("/seller/:id", (0, auth_middleware_1.authorizeRoles)(client_1.Role.SELLER), order_controller_1.getSellerOrderDetail);
/**
 * @swagger
 * /api/orders/{id}/status:
 *   patch:
 *     summary: Update status pesanan oleh seller
 *     tags: [Orders]
 *     description: Seller pemilik toko mengubah status pengiriman/order sesuai alur lifecycle SEAPEDIA. Admin tidak mengelola order melalui endpoint ini.
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
 *             $ref: '#/components/schemas/UpdateOrderStatusRequest'
 *     responses:
 *       200:
 *         description: Status pesanan berhasil diperbarui
 *       400:
 *         description: Status tidak valid atau transisi status tidak diperbolehkan
 *       401:
 *         description: Token tidak valid atau user belum login
 *       403:
 *         description: Hanya seller pemilik toko yang boleh mengubah status pesanan
 *       404:
 *         description: Pesanan tidak ditemukan
 */
router.patch("/:id/status", (0, auth_middleware_1.authorizeRoles)(client_1.Role.SELLER), order_controller_1.updateOrderStatus);
/**
 * @swagger
 * /api/orders/{id}/payment:
 *   patch:
 *     summary: Update status pembayaran pesanan oleh seller
 *     tags: [Orders]
 *     description: Seller pemilik toko mengubah status pembayaran pesanan menjadi PENDING, PAID, FAILED, atau REFUNDED. Admin hanya melihat transaksi melalui admin endpoint dan tidak mengubah pembayaran.
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
 *             $ref: '#/components/schemas/UpdatePaymentStatusRequest'
 *     responses:
 *       200:
 *         description: Status pembayaran berhasil diperbarui
 *       400:
 *         description: Status pembayaran tidak valid
 *       401:
 *         description: Token tidak valid atau user belum login
 *       403:
 *         description: Hanya seller pemilik toko yang boleh mengubah status pembayaran pesanan
 *       404:
 *         description: Pesanan tidak ditemukan
 */
router.patch("/:id/payment", (0, auth_middleware_1.authorizeRoles)(client_1.Role.SELLER), order_controller_1.updatePaymentStatus);
exports.default = router;
