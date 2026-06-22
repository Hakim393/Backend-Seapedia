"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const admin_routes_1 = __importDefault(require("./admin.routes"));
const auth_routes_1 = __importDefault(require("./auth.routes"));
const cart_routes_1 = __importDefault(require("./cart.routes"));
const order_routes_1 = __importDefault(require("./order.routes"));
const product_routes_1 = __importDefault(require("./product.routes"));
const review_routes_1 = __importDefault(require("./review.routes"));
const store_routes_1 = __importDefault(require("./store.routes"));
const router = (0, express_1.Router)();
/**
 * @swagger
 * /api:
 *   get:
 *     summary: API health check
 *     tags: [Health]
 *     description: Mengecek apakah SEAPEDIA Backend API berjalan dengan baik.
 *     responses:
 *       200:
 *         description: API berhasil berjalan
 */
router.get("/", (_req, res) => {
    return res.status(200).json({
        success: true,
        message: "SEAPEDIA Backend API is running.",
    });
});
router.use("/auth", auth_routes_1.default);
router.use("/admin", admin_routes_1.default);
router.use("/cart", cart_routes_1.default);
router.use("/orders", order_routes_1.default);
router.use("/products", product_routes_1.default);
router.use("/reviews", review_routes_1.default);
router.use("/stores", store_routes_1.default);
exports.default = router;
