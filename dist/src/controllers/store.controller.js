"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateMyStore = exports.deactivateMyStore = exports.updateMyStore = exports.createStore = exports.getMyStore = exports.getStoreProducts = exports.getStoreBySlug = exports.getStoreById = exports.getAllStores = void 0;
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
const slugify = (value) => {
    const slug = value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    return slug || "store";
};
const createUniqueStoreSlug = async (name, ignoreStoreId) => {
    const baseSlug = slugify(name);
    let slug = baseSlug;
    let counter = 1;
    while (true) {
        const existingStore = await prisma_1.default.store.findFirst({
            where: {
                slug,
                ...(ignoreStoreId
                    ? {
                        NOT: {
                            id: ignoreStoreId,
                        },
                    }
                    : {}),
            },
            select: {
                id: true,
            },
        });
        if (!existingStore) {
            return slug;
        }
        counter += 1;
        slug = `${baseSlug}-${counter}`;
    }
};
const normalizeProduct = (product) => {
    return {
        ...product,
        price: Number(product.price),
    };
};
const storeListInclude = {
    seller: {
        select: {
            id: true,
            name: true,
            email: true,
        },
    },
    _count: {
        select: {
            products: true,
            orders: true,
        },
    },
};
const storeDetailInclude = {
    seller: {
        select: {
            id: true,
            name: true,
            email: true,
        },
    },
    products: {
        where: {
            status: client_1.ProductStatus.ACTIVE,
        },
        take: 8,
        orderBy: {
            createdAt: "desc",
        },
        include: {
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
                },
            },
        },
    },
    _count: {
        select: {
            products: true,
            orders: true,
        },
    },
};
const getAllStores = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPagination(req);
        const search = (0, sanitize_1.sanitizeSearchQuery)(req.query.search);
        const where = {
            status: client_1.StoreStatus.ACTIVE,
        };
        if (search) {
            where.OR = [
                {
                    name: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
                {
                    description: {
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
        const [stores, total] = await prisma_1.default.$transaction([
            prisma_1.default.store.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    createdAt: "desc",
                },
                include: storeListInclude,
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
exports.getAllStores = getAllStores;
const getStoreById = async (req, res, next) => {
    try {
        const storeId = parseIdParam(req.params.id, "Store ID");
        const store = await prisma_1.default.store.findFirst({
            where: {
                id: storeId,
                status: client_1.StoreStatus.ACTIVE,
            },
            include: storeDetailInclude,
        });
        if (!store) {
            throw new error_middleware_1.AppError("Toko tidak ditemukan.", 404);
        }
        return res.status(200).json({
            success: true,
            message: "Detail toko berhasil diambil.",
            data: {
                ...store,
                products: store.products.map(normalizeProduct),
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getStoreById = getStoreById;
const getStoreBySlug = async (req, res, next) => {
    try {
        const slug = (0, sanitize_1.sanitizeText)(req.params.slug, {
            maxLength: 180,
            trim: true,
            allowNewLines: false,
        });
        if (!slug) {
            throw new error_middleware_1.AppError("Slug toko tidak valid.", 400);
        }
        const store = await prisma_1.default.store.findFirst({
            where: {
                slug,
                status: client_1.StoreStatus.ACTIVE,
            },
            include: storeDetailInclude,
        });
        if (!store) {
            throw new error_middleware_1.AppError("Toko tidak ditemukan.", 404);
        }
        return res.status(200).json({
            success: true,
            message: "Detail toko berhasil diambil.",
            data: {
                ...store,
                products: store.products.map(normalizeProduct),
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getStoreBySlug = getStoreBySlug;
const getStoreProducts = async (req, res, next) => {
    try {
        const storeId = parseIdParam(req.params.id, "Store ID");
        const { page, limit, skip } = getPagination(req);
        const search = (0, sanitize_1.sanitizeSearchQuery)(req.query.search);
        const categoryId = req.query.categoryId;
        const sort = String(req.query.sort || "latest");
        const store = await prisma_1.default.store.findFirst({
            where: {
                id: storeId,
                status: client_1.StoreStatus.ACTIVE,
            },
            select: {
                id: true,
                name: true,
                slug: true,
                status: true,
            },
        });
        if (!store) {
            throw new error_middleware_1.AppError("Toko tidak ditemukan.", 404);
        }
        const where = {
            storeId,
            status: client_1.ProductStatus.ACTIVE,
        };
        if (search) {
            where.OR = [
                {
                    name: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
                {
                    description: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
            ];
        }
        if (categoryId) {
            where.categoryId = parseIdParam(categoryId, "Category ID");
        }
        let orderBy = {
            createdAt: "desc",
        };
        if (sort === "price_asc") {
            orderBy = {
                price: "asc",
            };
        }
        if (sort === "price_desc") {
            orderBy = {
                price: "desc",
            };
        }
        if (sort === "name_asc") {
            orderBy = {
                name: "asc",
            };
        }
        if (sort === "oldest") {
            orderBy = {
                createdAt: "asc",
            };
        }
        const [products, total] = await prisma_1.default.$transaction([
            prisma_1.default.product.findMany({
                where,
                skip,
                take: limit,
                orderBy,
                include: {
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
            message: "Data produk toko berhasil diambil.",
            data: {
                store,
                products: products.map(normalizeProduct),
            },
            meta: createPaginationMeta(page, limit, total),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getStoreProducts = getStoreProducts;
const getMyStore = async (req, res, next) => {
    try {
        const sellerId = getUserId(req);
        const store = await prisma_1.default.store.findUnique({
            where: {
                sellerId,
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
                products: {
                    take: 8,
                    orderBy: {
                        createdAt: "desc",
                    },
                    include: {
                        category: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                            },
                        },
                    },
                },
                _count: {
                    select: {
                        products: true,
                        orders: true,
                        carts: true,
                    },
                },
            },
        });
        if (!store) {
            throw new error_middleware_1.AppError("Kamu belum memiliki toko.", 404);
        }
        return res.status(200).json({
            success: true,
            message: "Data toko saya berhasil diambil.",
            data: {
                ...store,
                products: store.products.map(normalizeProduct),
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getMyStore = getMyStore;
const createStore = async (req, res, next) => {
    try {
        const sellerId = getUserId(req);
        const { name, description, logoUrl, address } = req.body;
        const existingStore = await prisma_1.default.store.findUnique({
            where: {
                sellerId,
            },
            select: {
                id: true,
            },
        });
        if (existingStore) {
            throw new error_middleware_1.AppError("Kamu sudah memiliki toko.", 409);
        }
        const cleanName = (0, sanitize_1.sanitizeText)(name, {
            maxLength: 150,
            trim: true,
            allowNewLines: false,
        });
        const cleanDescription = (0, sanitize_1.sanitizeNullableText)(description, {
            maxLength: 2000,
            trim: true,
            allowNewLines: true,
        });
        const cleanLogoUrl = (0, sanitize_1.sanitizeNullableText)(logoUrl, {
            maxLength: 1000,
            trim: true,
            allowNewLines: false,
        });
        const cleanAddress = (0, sanitize_1.sanitizeNullableText)(address, {
            maxLength: 500,
            trim: true,
            allowNewLines: true,
        });
        if (!cleanName) {
            throw new error_middleware_1.AppError("Nama toko wajib diisi.", 400);
        }
        const slug = await createUniqueStoreSlug(cleanName);
        const store = await prisma_1.default.store.create({
            data: {
                name: cleanName,
                slug,
                description: cleanDescription,
                logoUrl: cleanLogoUrl,
                address: cleanAddress,
                status: client_1.StoreStatus.ACTIVE,
                sellerId,
            },
            include: storeListInclude,
        });
        return res.status(201).json({
            success: true,
            message: "Toko berhasil dibuat.",
            data: store,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createStore = createStore;
const updateMyStore = async (req, res, next) => {
    try {
        const sellerId = getUserId(req);
        const { name, description, logoUrl, address } = req.body;
        const store = await prisma_1.default.store.findUnique({
            where: {
                sellerId,
            },
        });
        if (!store) {
            throw new error_middleware_1.AppError("Kamu belum memiliki toko.", 404);
        }
        const updateData = {};
        if (name !== undefined) {
            const cleanName = (0, sanitize_1.sanitizeText)(name, {
                maxLength: 150,
                trim: true,
                allowNewLines: false,
            });
            if (!cleanName) {
                throw new error_middleware_1.AppError("Nama toko tidak boleh kosong.", 400);
            }
            updateData.name = cleanName;
            updateData.slug = await createUniqueStoreSlug(cleanName, store.id);
        }
        if (description !== undefined) {
            updateData.description = (0, sanitize_1.sanitizeNullableText)(description, {
                maxLength: 2000,
                trim: true,
                allowNewLines: true,
            });
        }
        if (logoUrl !== undefined) {
            updateData.logoUrl = (0, sanitize_1.sanitizeNullableText)(logoUrl, {
                maxLength: 1000,
                trim: true,
                allowNewLines: false,
            });
        }
        if (address !== undefined) {
            updateData.address = (0, sanitize_1.sanitizeNullableText)(address, {
                maxLength: 500,
                trim: true,
                allowNewLines: true,
            });
        }
        if (Object.keys(updateData).length === 0) {
            throw new error_middleware_1.AppError("Tidak ada data yang diperbarui.", 400);
        }
        const updatedStore = await prisma_1.default.store.update({
            where: {
                id: store.id,
            },
            data: updateData,
            include: storeListInclude,
        });
        return res.status(200).json({
            success: true,
            message: "Toko berhasil diperbarui.",
            data: updatedStore,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateMyStore = updateMyStore;
const deactivateMyStore = async (req, res, next) => {
    try {
        const sellerId = getUserId(req);
        const store = await prisma_1.default.store.findUnique({
            where: {
                sellerId,
            },
            select: {
                id: true,
                status: true,
            },
        });
        if (!store) {
            throw new error_middleware_1.AppError("Kamu belum memiliki toko.", 404);
        }
        if (store.status === client_1.StoreStatus.INACTIVE) {
            return res.status(200).json({
                success: true,
                message: "Toko sudah dalam keadaan tidak aktif.",
            });
        }
        const updatedStore = await prisma_1.default.store.update({
            where: {
                id: store.id,
            },
            data: {
                status: client_1.StoreStatus.INACTIVE,
                products: {
                    updateMany: {
                        where: {
                            status: client_1.ProductStatus.ACTIVE,
                        },
                        data: {
                            status: client_1.ProductStatus.INACTIVE,
                        },
                    },
                },
            },
            include: storeListInclude,
        });
        return res.status(200).json({
            success: true,
            message: "Toko berhasil dinonaktifkan.",
            data: updatedStore,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.deactivateMyStore = deactivateMyStore;
const activateMyStore = async (req, res, next) => {
    try {
        const sellerId = getUserId(req);
        const store = await prisma_1.default.store.findUnique({
            where: {
                sellerId,
            },
            select: {
                id: true,
                status: true,
            },
        });
        if (!store) {
            throw new error_middleware_1.AppError("Kamu belum memiliki toko.", 404);
        }
        if (store.status === client_1.StoreStatus.SUSPENDED) {
            throw new error_middleware_1.AppError("Toko kamu sedang disuspend oleh admin dan tidak bisa diaktifkan sendiri.", 403);
        }
        if (store.status === client_1.StoreStatus.ACTIVE) {
            return res.status(200).json({
                success: true,
                message: "Toko sudah dalam keadaan aktif.",
            });
        }
        const updatedStore = await prisma_1.default.store.update({
            where: {
                id: store.id,
            },
            data: {
                status: client_1.StoreStatus.ACTIVE,
            },
            include: storeListInclude,
        });
        return res.status(200).json({
            success: true,
            message: "Toko berhasil diaktifkan.",
            data: updatedStore,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.activateMyStore = activateMyStore;
