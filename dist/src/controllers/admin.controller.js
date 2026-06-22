"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteApplicationReviewForAdmin = exports.getAllApplicationReviewsForAdmin = exports.deleteProductReviewForAdmin = exports.getAllProductReviewsForAdmin = exports.getOrderDetailForAdmin = exports.getAllOrdersForAdmin = exports.updateProductStatus = exports.getAllProductsForAdmin = exports.updateStoreStatus = exports.getAllStoresForAdmin = exports.deleteUser = exports.updateUserRole = exports.getUserById = exports.getAllUsers = exports.getAdminDashboard = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../config/prisma"));
const error_middleware_1 = require("../middleware/error.middleware");
const parsePositiveInt = (value, defaultValue, maxValue) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
        return defaultValue;
    }
    if (maxValue && parsed > maxValue) {
        return maxValue;
    }
    return parsed;
};
const getIdParam = (value, paramName = "id") => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
        throw new error_middleware_1.AppError(`${paramName} tidak valid.`, 400);
    }
    return parsed;
};
const getSearchQuery = (value) => {
    if (!value)
        return "";
    return String(value).trim();
};
const isValidEnumValue = (enumObject, value) => {
    return typeof value === "string" && Object.values(enumObject).includes(value);
};
const getPagination = (req) => {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 10, 100);
    const skip = (page - 1) * limit;
    return {
        page,
        limit,
        skip,
    };
};
const createPaginationMeta = (page, limit, total) => {
    return {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
    };
};
const getAdminDashboard = async (_req, res, next) => {
    try {
        const [totalUsers, totalBuyers, totalSellers, totalAdmins, totalStores, totalProducts, totalOrders, totalProductReviews, totalApplicationReviews, revenueAggregate, ordersByStatus, storesByStatus, productsByStatus, latestOrders, lowStockProducts,] = await prisma_1.default.$transaction([
            prisma_1.default.user.count(),
            prisma_1.default.user.count({
                where: {
                    role: client_1.Role.USER,
                },
            }),
            prisma_1.default.user.count({
                where: {
                    role: client_1.Role.SELLER,
                },
            }),
            prisma_1.default.user.count({
                where: {
                    role: client_1.Role.ADMIN,
                },
            }),
            prisma_1.default.store.count(),
            prisma_1.default.product.count(),
            prisma_1.default.order.count(),
            prisma_1.default.productReview.count(),
            prisma_1.default.applicationReview.count(),
            prisma_1.default.order.aggregate({
                where: {
                    paymentStatus: client_1.PaymentStatus.PAID,
                },
                _sum: {
                    totalAmount: true,
                },
            }),
            prisma_1.default.order.groupBy({
                by: ["status"],
                _count: {
                    status: true,
                },
                orderBy: {
                    status: "asc",
                },
            }),
            prisma_1.default.store.groupBy({
                by: ["status"],
                _count: {
                    status: true,
                },
                orderBy: {
                    status: "asc",
                },
            }),
            prisma_1.default.product.groupBy({
                by: ["status"],
                _count: {
                    status: true,
                },
                orderBy: {
                    status: "asc",
                },
            }),
            prisma_1.default.order.findMany({
                take: 5,
                orderBy: {
                    createdAt: "desc",
                },
                select: {
                    id: true,
                    orderNumber: true,
                    status: true,
                    paymentStatus: true,
                    totalAmount: true,
                    createdAt: true,
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                    store: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                        },
                    },
                },
            }),
            prisma_1.default.product.findMany({
                where: {
                    stock: {
                        lte: 5,
                    },
                },
                take: 5,
                orderBy: {
                    stock: "asc",
                },
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    stock: true,
                    status: true,
                    store: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                        },
                    },
                },
            }),
        ]);
        return res.status(200).json({
            success: true,
            message: "Data dashboard admin berhasil diambil.",
            data: {
                summary: {
                    totalUsers,
                    totalBuyers,
                    totalSellers,
                    totalAdmins,
                    totalStores,
                    totalProducts,
                    totalOrders,
                    totalProductReviews,
                    totalApplicationReviews,
                    totalRevenue: Number(revenueAggregate._sum.totalAmount || 0),
                },
                ordersByStatus,
                storesByStatus,
                productsByStatus,
                latestOrders,
                lowStockProducts,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getAdminDashboard = getAdminDashboard;
const getAllUsers = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPagination(req);
        const search = getSearchQuery(req.query.search);
        const { role } = req.query;
        const where = {};
        if (search) {
            where.OR = [
                {
                    name: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
                {
                    email: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
            ];
        }
        if (role) {
            if (!isValidEnumValue(client_1.Role, role)) {
                throw new error_middleware_1.AppError("Role tidak valid.", 400);
            }
            where.role = role;
        }
        const [users, total] = await prisma_1.default.$transaction([
            prisma_1.default.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    createdAt: "desc",
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    phone: true,
                    address: true,
                    createdAt: true,
                    updatedAt: true,
                    store: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            status: true,
                        },
                    },
                    _count: {
                        select: {
                            orders: true,
                            productReviews: true,
                            applicationReviews: true,
                        },
                    },
                },
            }),
            prisma_1.default.user.count({
                where,
            }),
        ]);
        return res.status(200).json({
            success: true,
            message: "Data user berhasil diambil.",
            data: users,
            meta: createPaginationMeta(page, limit, total),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getAllUsers = getAllUsers;
const getUserById = async (req, res, next) => {
    try {
        const userId = getIdParam(req.params.id, "User ID");
        const user = await prisma_1.default.user.findUnique({
            where: {
                id: userId,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                phone: true,
                address: true,
                createdAt: true,
                updatedAt: true,
                store: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        status: true,
                        createdAt: true,
                    },
                },
                orders: {
                    take: 5,
                    orderBy: {
                        createdAt: "desc",
                    },
                    select: {
                        id: true,
                        orderNumber: true,
                        status: true,
                        paymentStatus: true,
                        totalAmount: true,
                        createdAt: true,
                    },
                },
                _count: {
                    select: {
                        orders: true,
                        productReviews: true,
                        applicationReviews: true,
                    },
                },
            },
        });
        if (!user) {
            throw new error_middleware_1.AppError("User tidak ditemukan.", 404);
        }
        return res.status(200).json({
            success: true,
            message: "Detail user berhasil diambil.",
            data: user,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getUserById = getUserById;
const updateUserRole = async (req, res, next) => {
    try {
        const userId = getIdParam(req.params.id, "User ID");
        const { role } = req.body;
        if (!isValidEnumValue(client_1.Role, role)) {
            throw new error_middleware_1.AppError("Role tidak valid.", 400);
        }
        const user = await prisma_1.default.user.findUnique({
            where: {
                id: userId,
            },
            select: {
                id: true,
                role: true,
            },
        });
        if (!user) {
            throw new error_middleware_1.AppError("User tidak ditemukan.", 404);
        }
        if (user.role === client_1.Role.ADMIN && role !== client_1.Role.ADMIN) {
            const totalAdmin = await prisma_1.default.user.count({
                where: {
                    role: client_1.Role.ADMIN,
                },
            });
            if (totalAdmin <= 1) {
                throw new error_middleware_1.AppError("Tidak bisa mengubah role admin terakhir.", 400);
            }
        }
        const updatedUser = await prisma_1.default.user.update({
            where: {
                id: userId,
            },
            data: {
                role,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                phone: true,
                address: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        return res.status(200).json({
            success: true,
            message: "Role user berhasil diperbarui.",
            data: updatedUser,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateUserRole = updateUserRole;
const deleteUser = async (req, res, next) => {
    try {
        const userId = getIdParam(req.params.id, "User ID");
        if (req.user?.id === userId) {
            throw new error_middleware_1.AppError("Kamu tidak bisa menghapus akun sendiri.", 400);
        }
        const user = await prisma_1.default.user.findUnique({
            where: {
                id: userId,
            },
            select: {
                id: true,
                role: true,
            },
        });
        if (!user) {
            throw new error_middleware_1.AppError("User tidak ditemukan.", 404);
        }
        if (user.role === client_1.Role.ADMIN) {
            const totalAdmin = await prisma_1.default.user.count({
                where: {
                    role: client_1.Role.ADMIN,
                },
            });
            if (totalAdmin <= 1) {
                throw new error_middleware_1.AppError("Tidak bisa menghapus admin terakhir.", 400);
            }
        }
        await prisma_1.default.user.delete({
            where: {
                id: userId,
            },
        });
        return res.status(200).json({
            success: true,
            message: "User berhasil dihapus.",
        });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteUser = deleteUser;
const getAllStoresForAdmin = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPagination(req);
        const search = getSearchQuery(req.query.search);
        const { status } = req.query;
        const where = {};
        if (search) {
            where.OR = [
                {
                    name: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
                {
                    slug: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
            ];
        }
        if (status) {
            if (!isValidEnumValue(client_1.StoreStatus, status)) {
                throw new error_middleware_1.AppError("Status toko tidak valid.", 400);
            }
            where.status = status;
        }
        const [stores, total] = await prisma_1.default.$transaction([
            prisma_1.default.store.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    createdAt: "desc",
                },
                include: {
                    seller: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true,
                        },
                    },
                    _count: {
                        select: {
                            products: true,
                            orders: true,
                        },
                    },
                },
            }),
            prisma_1.default.store.count({
                where,
            }),
        ]);
        return res.status(200).json({
            success: true,
            message: "Data toko berhasil diambil.",
            data: stores,
            meta: createPaginationMeta(page, limit, total),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getAllStoresForAdmin = getAllStoresForAdmin;
const updateStoreStatus = async (req, res, next) => {
    try {
        const storeId = getIdParam(req.params.id, "Store ID");
        const { status } = req.body;
        if (!isValidEnumValue(client_1.StoreStatus, status)) {
            throw new error_middleware_1.AppError("Status toko tidak valid.", 400);
        }
        const store = await prisma_1.default.store.findUnique({
            where: {
                id: storeId,
            },
        });
        if (!store) {
            throw new error_middleware_1.AppError("Toko tidak ditemukan.", 404);
        }
        const updatedStore = await prisma_1.default.store.update({
            where: {
                id: storeId,
            },
            data: {
                status,
            },
            include: {
                seller: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                    },
                },
            },
        });
        return res.status(200).json({
            success: true,
            message: "Status toko berhasil diperbarui.",
            data: updatedStore,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateStoreStatus = updateStoreStatus;
const getAllProductsForAdmin = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPagination(req);
        const search = getSearchQuery(req.query.search);
        const { status, storeId, categoryId } = req.query;
        const where = {};
        if (search) {
            where.OR = [
                {
                    name: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
                {
                    slug: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
            ];
        }
        if (status) {
            if (!isValidEnumValue(client_1.ProductStatus, status)) {
                throw new error_middleware_1.AppError("Status produk tidak valid.", 400);
            }
            where.status = status;
        }
        if (storeId) {
            where.storeId = getIdParam(storeId, "Store ID");
        }
        if (categoryId) {
            where.categoryId = getIdParam(categoryId, "Category ID");
        }
        const [products, total] = await prisma_1.default.$transaction([
            prisma_1.default.product.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    createdAt: "desc",
                },
                include: {
                    store: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            status: true,
                        },
                    },
                    category: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                        },
                    },
                    _count: {
                        select: {
                            productReviews: true,
                            orderItems: true,
                            cartItems: true,
                        },
                    },
                },
            }),
            prisma_1.default.product.count({
                where,
            }),
        ]);
        return res.status(200).json({
            success: true,
            message: "Data produk berhasil diambil.",
            data: products,
            meta: createPaginationMeta(page, limit, total),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getAllProductsForAdmin = getAllProductsForAdmin;
const updateProductStatus = async (req, res, next) => {
    try {
        const productId = getIdParam(req.params.id, "Product ID");
        const { status } = req.body;
        if (!isValidEnumValue(client_1.ProductStatus, status)) {
            throw new error_middleware_1.AppError("Status produk tidak valid.", 400);
        }
        const product = await prisma_1.default.product.findUnique({
            where: {
                id: productId,
            },
        });
        if (!product) {
            throw new error_middleware_1.AppError("Produk tidak ditemukan.", 404);
        }
        const updatedProduct = await prisma_1.default.product.update({
            where: {
                id: productId,
            },
            data: {
                status,
            },
            include: {
                store: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
                category: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
            },
        });
        return res.status(200).json({
            success: true,
            message: "Status produk berhasil diperbarui.",
            data: updatedProduct,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateProductStatus = updateProductStatus;
const getAllOrdersForAdmin = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPagination(req);
        const { status, paymentStatus, storeId, userId } = req.query;
        const where = {};
        if (status) {
            if (!isValidEnumValue(client_1.OrderStatus, status)) {
                throw new error_middleware_1.AppError("Status pesanan tidak valid.", 400);
            }
            where.status = status;
        }
        if (paymentStatus) {
            if (!isValidEnumValue(client_1.PaymentStatus, paymentStatus)) {
                throw new error_middleware_1.AppError("Status pembayaran tidak valid.", 400);
            }
            where.paymentStatus = paymentStatus;
        }
        if (storeId) {
            where.storeId = getIdParam(storeId, "Store ID");
        }
        if (userId) {
            where.userId = getIdParam(userId, "User ID");
        }
        const [orders, total] = await prisma_1.default.$transaction([
            prisma_1.default.order.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    createdAt: "desc",
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                    store: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                        },
                    },
                    _count: {
                        select: {
                            items: true,
                            statusHistories: true,
                        },
                    },
                },
            }),
            prisma_1.default.order.count({
                where,
            }),
        ]);
        return res.status(200).json({
            success: true,
            message: "Data pesanan berhasil diambil.",
            data: orders,
            meta: createPaginationMeta(page, limit, total),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getAllOrdersForAdmin = getAllOrdersForAdmin;
const getOrderDetailForAdmin = async (req, res, next) => {
    try {
        const orderId = getIdParam(req.params.id, "Order ID");
        const order = await prisma_1.default.order.findUnique({
            where: {
                id: orderId,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        address: true,
                    },
                },
                store: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        address: true,
                    },
                },
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                                imageUrl: true,
                            },
                        },
                    },
                },
                statusHistories: {
                    orderBy: {
                        createdAt: "desc",
                    },
                    include: {
                        changedBy: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                role: true,
                            },
                        },
                    },
                },
            },
        });
        if (!order) {
            throw new error_middleware_1.AppError("Pesanan tidak ditemukan.", 404);
        }
        return res.status(200).json({
            success: true,
            message: "Detail pesanan berhasil diambil.",
            data: order,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getOrderDetailForAdmin = getOrderDetailForAdmin;
const getAllProductReviewsForAdmin = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPagination(req);
        const { productId, userId } = req.query;
        const where = {};
        if (productId) {
            where.productId = getIdParam(productId, "Product ID");
        }
        if (userId) {
            where.userId = getIdParam(userId, "User ID");
        }
        const [reviews, total] = await prisma_1.default.$transaction([
            prisma_1.default.productReview.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    createdAt: "desc",
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                    product: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            store: {
                                select: {
                                    id: true,
                                    name: true,
                                    slug: true,
                                },
                            },
                        },
                    },
                },
            }),
            prisma_1.default.productReview.count({
                where,
            }),
        ]);
        return res.status(200).json({
            success: true,
            message: "Data review produk berhasil diambil.",
            data: reviews,
            meta: createPaginationMeta(page, limit, total),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getAllProductReviewsForAdmin = getAllProductReviewsForAdmin;
const deleteProductReviewForAdmin = async (req, res, next) => {
    try {
        const reviewId = getIdParam(req.params.id, "Review ID");
        const review = await prisma_1.default.productReview.findUnique({
            where: {
                id: reviewId,
            },
        });
        if (!review) {
            throw new error_middleware_1.AppError("Review produk tidak ditemukan.", 404);
        }
        await prisma_1.default.productReview.delete({
            where: {
                id: reviewId,
            },
        });
        return res.status(200).json({
            success: true,
            message: "Review produk berhasil dihapus.",
        });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteProductReviewForAdmin = deleteProductReviewForAdmin;
const getAllApplicationReviewsForAdmin = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPagination(req);
        const { userId } = req.query;
        const where = {};
        if (userId) {
            where.userId = getIdParam(userId, "User ID");
        }
        const [reviews, total] = await prisma_1.default.$transaction([
            prisma_1.default.applicationReview.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    createdAt: "desc",
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            }),
            prisma_1.default.applicationReview.count({
                where,
            }),
        ]);
        return res.status(200).json({
            success: true,
            message: "Data review aplikasi berhasil diambil.",
            data: reviews,
            meta: createPaginationMeta(page, limit, total),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getAllApplicationReviewsForAdmin = getAllApplicationReviewsForAdmin;
const deleteApplicationReviewForAdmin = async (req, res, next) => {
    try {
        const reviewId = getIdParam(req.params.id, "Application Review ID");
        const review = await prisma_1.default.applicationReview.findUnique({
            where: {
                id: reviewId,
            },
        });
        if (!review) {
            throw new error_middleware_1.AppError("Review aplikasi tidak ditemukan.", 404);
        }
        await prisma_1.default.applicationReview.delete({
            where: {
                id: reviewId,
            },
        });
        return res.status(200).json({
            success: true,
            message: "Review aplikasi berhasil dihapus.",
        });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteApplicationReviewForAdmin = deleteApplicationReviewForAdmin;
