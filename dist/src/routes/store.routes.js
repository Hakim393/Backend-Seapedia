"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const store_controller_1 = require("../controllers/store.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
/**
 * @swagger
 * /api/stores:
 *   get:
 *     summary: Ambil semua toko aktif
 *     tags: [Stores]
 *     description: Mengambil daftar toko aktif di SEAPEDIA secara public.
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
 *           example: gadget
 *     responses:
 *       200:
 *         description: Data toko berhasil diambil
 */
router.get("/", store_controller_1.getAllStores);
/**
 * @swagger
 * /api/stores:
 *   post:
 *     summary: Buat toko seller
 *     tags: [Stores]
 *     description: Seller membuat toko baru. Satu seller hanya boleh memiliki satu toko.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateStoreRequest'
 *     responses:
 *       201:
 *         description: Toko berhasil dibuat
 *       400:
 *         description: Data toko tidak valid
 *       401:
 *         description: Token tidak valid atau user belum login
 *       403:
 *         description: Hanya seller yang boleh membuat toko
 *       409:
 *         description: Seller sudah memiliki toko
 */
router.post("/", auth_middleware_1.authMiddleware, (0, auth_middleware_1.authorizeRoles)(client_1.Role.SELLER), store_controller_1.createStore);
/**
 * @swagger
 * /api/stores/seller/my-store:
 *   get:
 *     summary: Ambil toko milik seller login
 *     tags: [Stores]
 *     description: Mengambil data toko milik seller yang sedang login.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Data toko saya berhasil diambil
 *       401:
 *         description: Token tidak valid atau user belum login
 *       403:
 *         description: Hanya seller yang boleh mengakses endpoint ini
 *       404:
 *         description: Seller belum memiliki toko
 */
router.get("/seller/my-store", auth_middleware_1.authMiddleware, (0, auth_middleware_1.authorizeRoles)(client_1.Role.SELLER), store_controller_1.getMyStore);
/**
 * @swagger
 * /api/stores/seller/my-store:
 *   patch:
 *     summary: Update toko milik seller login
 *     tags: [Stores]
 *     description: Seller mengubah data toko miliknya sendiri.
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
 *                 example: Toko Gadget Nusantara
 *               description:
 *                 type: string
 *                 example: Toko perlengkapan gadget terpercaya.
 *               logoUrl:
 *                 type: string
 *                 example: https://example.com/logo.png
 *               address:
 *                 type: string
 *                 example: Tangerang, Banten
 *     responses:
 *       200:
 *         description: Toko berhasil diperbarui
 *       400:
 *         description: Data input tidak valid
 *       401:
 *         description: Token tidak valid atau user belum login
 *       403:
 *         description: Hanya seller yang boleh mengakses endpoint ini
 *       404:
 *         description: Seller belum memiliki toko
 */
router.patch("/seller/my-store", auth_middleware_1.authMiddleware, (0, auth_middleware_1.authorizeRoles)(client_1.Role.SELLER), store_controller_1.updateMyStore);
/**
 * @swagger
 * /api/stores/seller/my-store/deactivate:
 *   patch:
 *     summary: Nonaktifkan toko milik seller login
 *     tags: [Stores]
 *     description: Seller menonaktifkan tokonya sendiri. Produk aktif di toko tersebut juga akan ikut dinonaktifkan.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Toko berhasil dinonaktifkan
 *       401:
 *         description: Token tidak valid atau user belum login
 *       403:
 *         description: Hanya seller yang boleh mengakses endpoint ini
 *       404:
 *         description: Seller belum memiliki toko
 */
router.patch("/seller/my-store/deactivate", auth_middleware_1.authMiddleware, (0, auth_middleware_1.authorizeRoles)(client_1.Role.SELLER), store_controller_1.deactivateMyStore);
/**
 * @swagger
 * /api/stores/seller/my-store/activate:
 *   patch:
 *     summary: Aktifkan toko milik seller login
 *     tags: [Stores]
 *     description: Seller mengaktifkan kembali tokonya sendiri, kecuali toko sedang disuspend oleh admin.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Toko berhasil diaktifkan
 *       401:
 *         description: Token tidak valid atau user belum login
 *       403:
 *         description: Hanya seller yang boleh mengakses endpoint ini atau toko sedang disuspend
 *       404:
 *         description: Seller belum memiliki toko
 */
router.patch("/seller/my-store/activate", auth_middleware_1.authMiddleware, (0, auth_middleware_1.authorizeRoles)(client_1.Role.SELLER), store_controller_1.activateMyStore);
/**
 * @swagger
 * /api/stores/slug/{slug}:
 *   get:
 *     summary: Ambil detail toko berdasarkan slug
 *     tags: [Stores]
 *     description: Mengambil detail toko aktif berdasarkan slug toko.
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *           example: toko-gadget-nusantara
 *     responses:
 *       200:
 *         description: Detail toko berhasil diambil
 *       400:
 *         description: Slug toko tidak valid
 *       404:
 *         description: Toko tidak ditemukan
 */
router.get("/slug/:slug", store_controller_1.getStoreBySlug);
/**
 * @swagger
 * /api/stores/{id}/products:
 *   get:
 *     summary: Ambil produk dari toko
 *     tags: [Stores]
 *     description: Mengambil daftar produk aktif dari toko tertentu.
 *     parameters:
 *       - in: path
 *         name: id
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
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [latest, oldest, price_asc, price_desc, name_asc]
 *           example: latest
 *     responses:
 *       200:
 *         description: Data produk toko berhasil diambil
 *       400:
 *         description: Store ID tidak valid
 *       404:
 *         description: Toko tidak ditemukan
 */
router.get("/:id/products", store_controller_1.getStoreProducts);
/**
 * @swagger
 * /api/stores/{id}:
 *   get:
 *     summary: Ambil detail toko berdasarkan ID
 *     tags: [Stores]
 *     description: Mengambil detail toko aktif berdasarkan ID toko.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Detail toko berhasil diambil
 *       400:
 *         description: Store ID tidak valid
 *       404:
 *         description: Toko tidak ditemukan
 */
router.get("/:id", store_controller_1.getStoreById);
exports.default = router;
