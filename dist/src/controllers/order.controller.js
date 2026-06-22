"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestReturnOrder = exports.markMyOrderAsCompleted = exports.updatePaymentStatus = exports.updateOrderStatus = exports.getSellerOrderDetail = exports.getSellerOrders = exports.getMyOrderDetail = exports.getMyOrders = exports.checkout = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../config/prisma"));
const error_middleware_1 = require("../middleware/error.middleware");
const sanitize_1 = require("../utils/sanitize");
const getUserId = (req) => {
    if (!req.user) {
        throw new error_middleware_1.AppError("Silakan login terlebih dahulu.", 401);
    }
    return req.user.id;
};
const parseIdParam = (value, paramName = "id") => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
        throw new error_middleware_1.AppError(`${paramName} tidak valid.`, 400);
    }
    return parsed;
};
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
const isValidEnumValue = (enumObject, value) => {
    return typeof value === "string" && Object.values(enumObject).includes(value);
};
const generateOrderNumber = () => {
    const now = new Date();
    const datePart = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
    ].join("");
    const timePart = [
        String(now.getHours()).padStart(2, "0"),
        String(now.getMinutes()).padStart(2, "0"),
        String(now.getSeconds()).padStart(2, "0"),
    ].join("");
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    return `SEA-${datePart}-${timePart}-${randomPart}`;
};
const orderInclude = {
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
            logoUrl: true,
            address: true,
            status: true,
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
                    status: true,
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
};
const normalizeOrder = (order) => {
    return {
        ...order,
        totalAmount: Number(order.totalAmount),
        items: order.items?.map((item) => ({
            ...item,
            price: Number(item.price),
            subtotal: Number(item.subtotal),
        })),
    };
};
const validateOrderStatusTransition = (currentStatus, newStatus) => {
    if (currentStatus === newStatus) {
        return;
    }
    const allowedTransitions = {
        [client_1.OrderStatus.SEDANG_DIKEMAS]: [
            client_1.OrderStatus.MENUNGGU_PENGIRIM,
            client_1.OrderStatus.DIKEMBALIKAN,
        ],
        [client_1.OrderStatus.MENUNGGU_PENGIRIM]: [
            client_1.OrderStatus.SEDANG_DIKIRIM,
            client_1.OrderStatus.DIKEMBALIKAN,
        ],
        [client_1.OrderStatus.SEDANG_DIKIRIM]: [
            client_1.OrderStatus.PESANAN_SELESAI,
            client_1.OrderStatus.DIKEMBALIKAN,
        ],
        [client_1.OrderStatus.PESANAN_SELESAI]: [client_1.OrderStatus.DIKEMBALIKAN],
        [client_1.OrderStatus.DIKEMBALIKAN]: [],
    };
    if (!allowedTransitions[currentStatus].includes(newStatus)) {
        throw new error_middleware_1.AppError(`Status pesanan tidak bisa diubah dari ${currentStatus} ke ${newStatus}.`, 400);
    }
};
const getSellerStore = async (sellerId) => {
    const store = await prisma_1.default.store.findUnique({
        where: {
            sellerId,
        },
        select: {
            id: true,
            name: true,
            slug: true,
            status: true,
        },
    });
    if (!store) {
        throw new error_middleware_1.AppError("Seller belum memiliki toko.", 404);
    }
    return store;
};
const checkout = async (req, res, next) => {
    try {
        const userId = getUserId(req);
        const { shippingAddress, paymentMethod, notes } = req.body;
        const cleanShippingAddress = (0, sanitize_1.sanitizeText)(shippingAddress, {
            maxLength: 500,
            trim: true,
            allowNewLines: true,
        });
        const cleanPaymentMethod = (0, sanitize_1.sanitizeNullableText)(paymentMethod || "COD", {
            maxLength: 50,
            trim: true,
            allowNewLines: false,
        });
        const cleanNotes = (0, sanitize_1.sanitizeNullableText)(notes, {
            maxLength: 500,
            trim: true,
            allowNewLines: true,
        });
        if (!cleanShippingAddress) {
            throw new error_middleware_1.AppError("Alamat pengiriman wajib diisi.", 400);
        }
        const createdOrder = await prisma_1.default.$transaction(async (tx) => {
            const cart = await tx.cart.findUnique({
                where: {
                    userId,
                },
                include: {
                    store: true,
                    items: {
                        include: {
                            product: {
                                include: {
                                    store: true,
                                },
                            },
                        },
                    },
                },
            });
            if (!cart || cart.items.length === 0) {
                throw new error_middleware_1.AppError("Cart masih kosong.", 400);
            }
            if (!cart.storeId) {
                throw new error_middleware_1.AppError("Cart tidak memiliki informasi toko.", 400);
            }
            if (!cart.store) {
                throw new error_middleware_1.AppError("Toko tidak ditemukan.", 404);
            }
            if (cart.store.status !== client_1.StoreStatus.ACTIVE) {
                throw new error_middleware_1.AppError("Toko sedang tidak aktif.", 400);
            }
            const hasDifferentStore = cart.items.some((item) => item.product.storeId !== cart.storeId);
            if (hasDifferentStore) {
                throw new error_middleware_1.AppError("Cart tidak valid. Satu cart hanya boleh berisi produk dari satu toko.", 400);
            }
            let totalAmount = 0;
            for (const item of cart.items) {
                if (item.product.status !== client_1.ProductStatus.ACTIVE) {
                    throw new error_middleware_1.AppError(`Produk ${item.product.name} sedang tidak aktif.`, 400);
                }
                if (item.product.store.status !== client_1.StoreStatus.ACTIVE) {
                    throw new error_middleware_1.AppError(`Toko dari produk ${item.product.name} sedang tidak aktif.`, 400);
                }
                if (item.product.stock < item.quantity) {
                    throw new error_middleware_1.AppError(`Stok produk ${item.product.name} tidak mencukupi. Stok tersedia hanya ${item.product.stock}.`, 400);
                }
                totalAmount += Number(item.product.price) * item.quantity;
            }
            const order = await tx.order.create({
                data: {
                    orderNumber: generateOrderNumber(),
                    userId,
                    storeId: cart.storeId,
                    status: client_1.OrderStatus.SEDANG_DIKEMAS,
                    paymentStatus: client_1.PaymentStatus.PENDING,
                    paymentMethod: cleanPaymentMethod,
                    totalAmount,
                    shippingAddress: cleanShippingAddress,
                    notes: cleanNotes,
                    items: {
                        create: cart.items.map((item) => {
                            const price = Number(item.product.price);
                            const subtotal = price * item.quantity;
                            return {
                                productId: item.productId,
                                productName: item.product.name,
                                productImage: item.product.imageUrl,
                                price,
                                quantity: item.quantity,
                                subtotal,
                            };
                        }),
                    },
                    statusHistories: {
                        create: {
                            oldStatus: null,
                            newStatus: client_1.OrderStatus.SEDANG_DIKEMAS,
                            note: "Pesanan dibuat melalui checkout.",
                            changedById: userId,
                        },
                    },
                },
                include: orderInclude,
            });
            for (const item of cart.items) {
                const updatedProduct = await tx.product.update({
                    where: {
                        id: item.productId,
                    },
                    data: {
                        stock: {
                            decrement: item.quantity,
                        },
                    },
                    select: {
                        id: true,
                        stock: true,
                    },
                });
                if (updatedProduct.stock <= 0) {
                    await tx.product.update({
                        where: {
                            id: updatedProduct.id,
                        },
                        data: {
                            status: client_1.ProductStatus.OUT_OF_STOCK,
                        },
                    });
                }
            }
            await tx.cartItem.deleteMany({
                where: {
                    cartId: cart.id,
                },
            });
            await tx.cart.update({
                where: {
                    id: cart.id,
                },
                data: {
                    storeId: null,
                },
            });
            return order;
        });
        return res.status(201).json({
            success: true,
            message: "Checkout berhasil. Pesanan berhasil dibuat.",
            data: normalizeOrder(createdOrder),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.checkout = checkout;
const getMyOrders = async (req, res, next) => {
    try {
        const userId = getUserId(req);
        const { page, limit, skip } = getPagination(req);
        const { status, paymentStatus } = req.query;
        const where = {
            userId,
        };
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
        const [orders, total] = await prisma_1.default.$transaction([
            prisma_1.default.order.findMany({
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
                            logoUrl: true,
                        },
                    },
                    _count: {
                        select: {
                            items: true,
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
            data: orders.map((order) => ({
                ...order,
                totalAmount: Number(order.totalAmount),
            })),
            meta: createPaginationMeta(page, limit, total),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getMyOrders = getMyOrders;
const getMyOrderDetail = async (req, res, next) => {
    try {
        const userId = getUserId(req);
        const orderId = parseIdParam(req.params.id, "Order ID");
        const order = await prisma_1.default.order.findFirst({
            where: {
                id: orderId,
                userId,
            },
            include: orderInclude,
        });
        if (!order) {
            throw new error_middleware_1.AppError("Pesanan tidak ditemukan.", 404);
        }
        return res.status(200).json({
            success: true,
            message: "Detail pesanan berhasil diambil.",
            data: normalizeOrder(order),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getMyOrderDetail = getMyOrderDetail;
const getSellerOrders = async (req, res, next) => {
    try {
        const sellerId = getUserId(req);
        const { page, limit, skip } = getPagination(req);
        const { status, paymentStatus } = req.query;
        const store = await getSellerStore(sellerId);
        const where = {
            storeId: store.id,
        };
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
                            phone: true,
                        },
                    },
                    _count: {
                        select: {
                            items: true,
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
            message: "Data pesanan toko berhasil diambil.",
            data: orders.map((order) => ({
                ...order,
                totalAmount: Number(order.totalAmount),
            })),
            meta: createPaginationMeta(page, limit, total),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getSellerOrders = getSellerOrders;
const getSellerOrderDetail = async (req, res, next) => {
    try {
        const sellerId = getUserId(req);
        const orderId = parseIdParam(req.params.id, "Order ID");
        const store = await getSellerStore(sellerId);
        const order = await prisma_1.default.order.findFirst({
            where: {
                id: orderId,
                storeId: store.id,
            },
            include: orderInclude,
        });
        if (!order) {
            throw new error_middleware_1.AppError("Pesanan tidak ditemukan.", 404);
        }
        return res.status(200).json({
            success: true,
            message: "Detail pesanan toko berhasil diambil.",
            data: normalizeOrder(order),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getSellerOrderDetail = getSellerOrderDetail;
const updateOrderStatus = async (req, res, next) => {
    try {
        const sellerId = getUserId(req);
        const orderId = parseIdParam(req.params.id, "Order ID");
        const { status, courierName, trackingNumber, note } = req.body;
        if (!isValidEnumValue(client_1.OrderStatus, status)) {
            throw new error_middleware_1.AppError("Status pesanan tidak valid.", 400);
        }
        const order = await prisma_1.default.order.findUnique({
            where: {
                id: orderId,
            },
            include: {
                store: {
                    select: {
                        id: true,
                        sellerId: true,
                    },
                },
            },
        });
        if (!order) {
            throw new error_middleware_1.AppError("Pesanan tidak ditemukan.", 404);
        }
        if (order.store.sellerId !== sellerId) {
            throw new error_middleware_1.AppError("Kamu tidak memiliki akses untuk mengubah pesanan toko ini.", 403);
        }
        validateOrderStatusTransition(order.status, status);
        const cleanCourierName = (0, sanitize_1.sanitizeNullableText)(courierName, {
            maxLength: 100,
            trim: true,
            allowNewLines: false,
        });
        const cleanTrackingNumber = (0, sanitize_1.sanitizeNullableText)(trackingNumber, {
            maxLength: 100,
            trim: true,
            allowNewLines: false,
        });
        const cleanNote = (0, sanitize_1.sanitizeNullableText)(note, {
            maxLength: 500,
            trim: true,
            allowNewLines: true,
        });
        const updatedOrder = await prisma_1.default.order.update({
            where: {
                id: orderId,
            },
            data: {
                status,
                courierName: cleanCourierName !== null ? cleanCourierName : order.courierName,
                trackingNumber: cleanTrackingNumber !== null
                    ? cleanTrackingNumber
                    : order.trackingNumber,
                completedAt: status === client_1.OrderStatus.PESANAN_SELESAI
                    ? new Date()
                    : order.completedAt,
                returnedAt: status === client_1.OrderStatus.DIKEMBALIKAN ? new Date() : order.returnedAt,
                statusHistories: {
                    create: {
                        oldStatus: order.status,
                        newStatus: status,
                        note: cleanNote,
                        changedById: sellerId,
                    },
                },
            },
            include: orderInclude,
        });
        return res.status(200).json({
            success: true,
            message: "Status pesanan berhasil diperbarui.",
            data: normalizeOrder(updatedOrder),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateOrderStatus = updateOrderStatus;
const updatePaymentStatus = async (req, res, next) => {
    try {
        const sellerId = getUserId(req);
        const orderId = parseIdParam(req.params.id, "Order ID");
        const { paymentStatus } = req.body;
        if (!isValidEnumValue(client_1.PaymentStatus, paymentStatus)) {
            throw new error_middleware_1.AppError("Status pembayaran tidak valid.", 400);
        }
        const order = await prisma_1.default.order.findUnique({
            where: {
                id: orderId,
            },
            include: {
                store: {
                    select: {
                        id: true,
                        sellerId: true,
                    },
                },
            },
        });
        if (!order) {
            throw new error_middleware_1.AppError("Pesanan tidak ditemukan.", 404);
        }
        if (order.store.sellerId !== sellerId) {
            throw new error_middleware_1.AppError("Kamu tidak memiliki akses untuk mengubah pembayaran pesanan toko ini.", 403);
        }
        let paidAt = order.paidAt;
        if (paymentStatus === client_1.PaymentStatus.PAID) {
            paidAt = order.paidAt ?? new Date();
        }
        if (paymentStatus === client_1.PaymentStatus.PENDING ||
            paymentStatus === client_1.PaymentStatus.FAILED) {
            paidAt = null;
        }
        const updatedOrder = await prisma_1.default.order.update({
            where: {
                id: orderId,
            },
            data: {
                paymentStatus,
                paidAt,
            },
            include: orderInclude,
        });
        return res.status(200).json({
            success: true,
            message: "Status pembayaran berhasil diperbarui.",
            data: normalizeOrder(updatedOrder),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updatePaymentStatus = updatePaymentStatus;
const markMyOrderAsCompleted = async (req, res, next) => {
    try {
        const userId = getUserId(req);
        const orderId = parseIdParam(req.params.id, "Order ID");
        const order = await prisma_1.default.order.findFirst({
            where: {
                id: orderId,
                userId,
            },
        });
        if (!order) {
            throw new error_middleware_1.AppError("Pesanan tidak ditemukan.", 404);
        }
        if (order.status !== client_1.OrderStatus.SEDANG_DIKIRIM) {
            throw new error_middleware_1.AppError("Pesanan hanya bisa diselesaikan saat status Sedang Dikirim.", 400);
        }
        const updatedOrder = await prisma_1.default.order.update({
            where: {
                id: orderId,
            },
            data: {
                status: client_1.OrderStatus.PESANAN_SELESAI,
                completedAt: new Date(),
                statusHistories: {
                    create: {
                        oldStatus: order.status,
                        newStatus: client_1.OrderStatus.PESANAN_SELESAI,
                        note: "Pesanan ditandai selesai oleh pembeli.",
                        changedById: userId,
                    },
                },
            },
            include: orderInclude,
        });
        return res.status(200).json({
            success: true,
            message: "Pesanan berhasil ditandai selesai.",
            data: normalizeOrder(updatedOrder),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.markMyOrderAsCompleted = markMyOrderAsCompleted;
const requestReturnOrder = async (req, res, next) => {
    try {
        const userId = getUserId(req);
        const orderId = parseIdParam(req.params.id, "Order ID");
        const { reason } = req.body;
        const cleanReason = (0, sanitize_1.sanitizeNullableText)(reason, {
            maxLength: 500,
            trim: true,
            allowNewLines: true,
        });
        const order = await prisma_1.default.order.findFirst({
            where: {
                id: orderId,
                userId,
            },
        });
        if (!order) {
            throw new error_middleware_1.AppError("Pesanan tidak ditemukan.", 404);
        }
        if (order.status !== client_1.OrderStatus.SEDANG_DIKIRIM &&
            order.status !== client_1.OrderStatus.PESANAN_SELESAI) {
            throw new error_middleware_1.AppError("Pesanan hanya bisa dikembalikan saat status Sedang Dikirim atau Pesanan Selesai.", 400);
        }
        const updatedOrder = await prisma_1.default.order.update({
            where: {
                id: orderId,
            },
            data: {
                status: client_1.OrderStatus.DIKEMBALIKAN,
                returnedAt: new Date(),
                statusHistories: {
                    create: {
                        oldStatus: order.status,
                        newStatus: client_1.OrderStatus.DIKEMBALIKAN,
                        note: cleanReason || "Pembeli mengajukan pengembalian pesanan.",
                        changedById: userId,
                    },
                },
            },
            include: orderInclude,
        });
        return res.status(200).json({
            success: true,
            message: "Pesanan berhasil diajukan sebagai dikembalikan.",
            data: normalizeOrder(updatedOrder),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.requestReturnOrder = requestReturnOrder;
