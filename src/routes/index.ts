import { Router } from "express";

import adminRoutes from "./admin.routes";
import authRoutes from "./auth.routes";
import cartRoutes from "./cart.routes";
import orderRoutes from "./order.routes";
import productRoutes from "./product.routes";
import reviewRoutes from "./review.routes";
import storeRoutes from "./store.routes";

const router = Router();

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

router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/cart", cartRoutes);
router.use("/orders", orderRoutes);
router.use("/products", productRoutes);
router.use("/reviews", reviewRoutes);
router.use("/stores", storeRoutes);

export default router;