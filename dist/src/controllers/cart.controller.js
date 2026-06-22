"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearCart = exports.removeCartItem = exports.updateCartItemQuantity = exports.addCartItem = exports.getCart = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../config/prisma"));
const error_middleware_1 = require("../middleware/error.middleware");
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
const parseQuantity = (value) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
        throw new error_middleware_1.AppError("Quantity harus berupa angka minimal 1.", 400);
    }
    return parsed;
};
const formatCart = (cart) => {
    if (!cart) {
        return {
            id: null,
            userId: null,
            storeId: null,
            store: null,
            items: [],
            totalItems: 0,
            totalQuantity: 0,
            totalAmount: 0,
        };
    }
    const items = cart.items.map((item) => {
        const price = Number(item.product.price);
        const subtotal = price * item.quantity;
        return {
            id: item.id,
            quantity: item.quantity,
            productId: item.productId,
            product: {
                id: item.product.id,
                name: item.product.name,
                slug: item.product.slug,
                description: item.product.description,
                price,
                stock: item.product.stock,
                imageUrl: item.product.imageUrl,
                status: item.product.status,
                storeId: item.product.storeId,
                category: item.product.category,
                store: item.product.store,
            },
            subtotal,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
        };
    });
    const totalQuantity = items.reduce((total, item) => total + item.quantity, 0);
    const totalAmount = items.reduce((total, item) => total + item.subtotal, 0);
    return {
        id: cart.id,
        userId: cart.userId,
        storeId: cart.storeId,
        store: cart.store,
        items,
        totalItems: items.length,
        totalQuantity,
        totalAmount,
        createdAt: cart.createdAt,
        updatedAt: cart.updatedAt,
    };
};
const getCartWithItems = async (userId) => {
    return prisma_1.default.cart.findUnique({
        where: {
            userId,
        },
        include: {
            store: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    logoUrl: true,
                    status: true,
                },
            },
            items: {
                orderBy: {
                    createdAt: "asc",
                },
                include: {
                    product: {
                        include: {
                            store: {
                                select: {
                                    id: true,
                                    name: true,
                                    slug: true,
                                    logoUrl: true,
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
                        },
                    },
                },
            },
        },
    });
};
const getCart = async (req, res, next) => {
    try {
        const userId = getUserId(req);
        const cart = await getCartWithItems(userId);
        return res.status(200).json({
            success: true,
            message: "Data cart berhasil diambil.",
            data: formatCart(cart),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getCart = getCart;
const addCartItem = async (req, res, next) => {
    try {
        const userId = getUserId(req);
        const productId = parseIdParam(req.body.productId, "Product ID");
        const quantity = parseQuantity(req.body.quantity);
        const product = await prisma_1.default.product.findUnique({
            where: {
                id: productId,
            },
            include: {
                store: true,
            },
        });
        if (!product) {
            throw new error_middleware_1.AppError("Produk tidak ditemukan.", 404);
        }
        if (product.status !== client_1.ProductStatus.ACTIVE) {
            throw new error_middleware_1.AppError("Produk sedang tidak aktif.", 400);
        }
        if (product.store.status !== client_1.StoreStatus.ACTIVE) {
            throw new error_middleware_1.AppError("Toko dari produk ini sedang tidak aktif.", 400);
        }
        if (product.stock < quantity) {
            throw new error_middleware_1.AppError("Stok produk tidak mencukupi.", 400);
        }
        let cart = await prisma_1.default.cart.findUnique({
            where: {
                userId,
            },
            include: {
                items: true,
            },
        });
        if (!cart) {
            cart = await prisma_1.default.cart.create({
                data: {
                    userId,
                    storeId: product.storeId,
                },
                include: {
                    items: true,
                },
            });
        }
        /**
         * RULE WAJIB SEAPEDIA:
         * Satu cart hanya boleh berisi produk dari satu toko.
         */
        if (cart.storeId && cart.storeId !== product.storeId) {
            throw new error_middleware_1.AppError("Keranjang kamu berisi produk dari toko lain. Kosongkan keranjang terlebih dahulu untuk membeli produk dari toko ini.", 400);
        }
        if (!cart.storeId) {
            cart = await prisma_1.default.cart.update({
                where: {
                    id: cart.id,
                },
                data: {
                    storeId: product.storeId,
                },
                include: {
                    items: true,
                },
            });
        }
        const existingItem = cart.items.find((item) => item.productId === productId);
        const newQuantity = existingItem
            ? existingItem.quantity + quantity
            : quantity;
        if (product.stock < newQuantity) {
            throw new error_middleware_1.AppError(`Stok produk tidak mencukupi. Stok tersedia hanya ${product.stock}.`, 400);
        }
        if (existingItem) {
            await prisma_1.default.cartItem.update({
                where: {
                    id: existingItem.id,
                },
                data: {
                    quantity: newQuantity,
                },
            });
        }
        else {
            await prisma_1.default.cartItem.create({
                data: {
                    cartId: cart.id,
                    productId,
                    quantity,
                },
            });
        }
        const updatedCart = await getCartWithItems(userId);
        return res.status(201).json({
            success: true,
            message: "Produk berhasil ditambahkan ke cart.",
            data: formatCart(updatedCart),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.addCartItem = addCartItem;
const updateCartItemQuantity = async (req, res, next) => {
    try {
        const userId = getUserId(req);
        const cartItemId = parseIdParam(req.params.itemId, "Cart Item ID");
        const quantity = parseQuantity(req.body.quantity);
        const cart = await prisma_1.default.cart.findUnique({
            where: {
                userId,
            },
        });
        if (!cart) {
            throw new error_middleware_1.AppError("Cart tidak ditemukan.", 404);
        }
        const cartItem = await prisma_1.default.cartItem.findFirst({
            where: {
                id: cartItemId,
                cartId: cart.id,
            },
            include: {
                product: true,
            },
        });
        if (!cartItem) {
            throw new error_middleware_1.AppError("Item cart tidak ditemukan.", 404);
        }
        if (cartItem.product.status !== client_1.ProductStatus.ACTIVE) {
            throw new error_middleware_1.AppError("Produk sedang tidak aktif.", 400);
        }
        if (cartItem.product.stock < quantity) {
            throw new error_middleware_1.AppError(`Stok produk tidak mencukupi. Stok tersedia hanya ${cartItem.product.stock}.`, 400);
        }
        await prisma_1.default.cartItem.update({
            where: {
                id: cartItemId,
            },
            data: {
                quantity,
            },
        });
        const updatedCart = await getCartWithItems(userId);
        return res.status(200).json({
            success: true,
            message: "Quantity cart berhasil diperbarui.",
            data: formatCart(updatedCart),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateCartItemQuantity = updateCartItemQuantity;
const removeCartItem = async (req, res, next) => {
    try {
        const userId = getUserId(req);
        const cartItemId = parseIdParam(req.params.itemId, "Cart Item ID");
        const cart = await prisma_1.default.cart.findUnique({
            where: {
                userId,
            },
            include: {
                items: true,
            },
        });
        if (!cart) {
            throw new error_middleware_1.AppError("Cart tidak ditemukan.", 404);
        }
        const cartItem = cart.items.find((item) => item.id === cartItemId);
        if (!cartItem) {
            throw new error_middleware_1.AppError("Item cart tidak ditemukan.", 404);
        }
        await prisma_1.default.cartItem.delete({
            where: {
                id: cartItemId,
            },
        });
        const remainingItems = await prisma_1.default.cartItem.count({
            where: {
                cartId: cart.id,
            },
        });
        if (remainingItems === 0) {
            await prisma_1.default.cart.update({
                where: {
                    id: cart.id,
                },
                data: {
                    storeId: null,
                },
            });
        }
        const updatedCart = await getCartWithItems(userId);
        return res.status(200).json({
            success: true,
            message: "Item cart berhasil dihapus.",
            data: formatCart(updatedCart),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.removeCartItem = removeCartItem;
const clearCart = async (req, res, next) => {
    try {
        const userId = getUserId(req);
        const cart = await prisma_1.default.cart.findUnique({
            where: {
                userId,
            },
        });
        if (!cart) {
            return res.status(200).json({
                success: true,
                message: "Cart sudah kosong.",
                data: formatCart(null),
            });
        }
        await prisma_1.default.$transaction([
            prisma_1.default.cartItem.deleteMany({
                where: {
                    cartId: cart.id,
                },
            }),
            prisma_1.default.cart.update({
                where: {
                    id: cart.id,
                },
                data: {
                    storeId: null,
                },
            }),
        ]);
        const updatedCart = await getCartWithItems(userId);
        return res.status(200).json({
            success: true,
            message: "Cart berhasil dikosongkan.",
            data: formatCart(updatedCart),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.clearCart = clearCart;
