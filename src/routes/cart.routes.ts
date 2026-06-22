import { Router } from "express";
import {
  addCartItem,
  clearCart,
  getCart,
  removeCartItem,
  updateCartItemQuantity,
} from "../controllers/cart.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.use(authMiddleware);

/**
 * @swagger
 * /api/cart:
 *   get:
 *     summary: Ambil isi cart user
 *     tags: [Cart]
 *     description: Mengambil isi keranjang user yang sedang login.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Data cart berhasil diambil
 *       401:
 *         description: Token tidak valid atau user belum login
 */
router.get("/", getCart);

/**
 * @swagger
 * /api/cart/items:
 *   post:
 *     summary: Tambah produk ke cart
 *     tags: [Cart]
 *     description: Menambahkan produk ke keranjang. Satu cart hanya boleh berisi produk dari satu toko. Jika cart berisi produk dari toko lain, request akan ditolak.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddCartItemRequest'
 *     responses:
 *       201:
 *         description: Produk berhasil ditambahkan ke cart
 *       400:
 *         description: Produk tidak valid, stok tidak cukup, atau cart berisi produk dari toko lain
 *       401:
 *         description: Token tidak valid atau user belum login
 *       404:
 *         description: Produk tidak ditemukan
 */
router.post("/items", addCartItem);

/**
 * @swagger
 * /api/cart/items/{itemId}:
 *   patch:
 *     summary: Update quantity item cart
 *     tags: [Cart]
 *     description: Mengubah jumlah quantity produk di dalam cart.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *         description: ID item cart
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateCartItemRequest'
 *     responses:
 *       200:
 *         description: Quantity cart berhasil diperbarui
 *       400:
 *         description: Quantity tidak valid atau stok tidak cukup
 *       401:
 *         description: Token tidak valid atau user belum login
 *       404:
 *         description: Cart atau item cart tidak ditemukan
 */
router.patch("/items/:itemId", updateCartItemQuantity);

/**
 * @swagger
 * /api/cart/items/{itemId}:
 *   delete:
 *     summary: Hapus item dari cart
 *     tags: [Cart]
 *     description: Menghapus satu item produk dari cart. Jika cart menjadi kosong, storeId cart akan di-reset menjadi null.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *         description: ID item cart
 *     responses:
 *       200:
 *         description: Item cart berhasil dihapus
 *       401:
 *         description: Token tidak valid atau user belum login
 *       404:
 *         description: Cart atau item cart tidak ditemukan
 */
router.delete("/items/:itemId", removeCartItem);

/**
 * @swagger
 * /api/cart:
 *   delete:
 *     summary: Kosongkan cart
 *     tags: [Cart]
 *     description: Menghapus semua item di cart user dan me-reset storeId cart menjadi null.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart berhasil dikosongkan
 *       401:
 *         description: Token tidak valid atau user belum login
 */
router.delete("/", clearCart);

export default router;