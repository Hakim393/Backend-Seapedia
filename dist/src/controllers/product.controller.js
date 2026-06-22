"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCategory = exports.updateCategory = exports.createCategory = exports.getCategories = exports.deleteProduct = exports.updateProduct = exports.createProduct = exports.getSellerProducts = exports.getProductBySlug = exports.getProductById = exports.getAllProducts = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../config/prisma"));
const error_middleware_1 = require("../middleware/error.middleware");
const sanitize_1 = require("../utils/sanitize");
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
const parsePrice = (value, fieldName = "Harga") => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new error_middleware_1.AppError(`${fieldName} harus berupa angka minimal 0.`, 400);
    }
    return parsed;
};
const parseStock = (value) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
        throw new error_middleware_1.AppError("Stok harus berupa angka minimal 0.", 400);
    }
    return parsed;
};
const isValidEnumValue = (enumObject, value) => {
    return typeof value === "string" && Object.values(enumObject).includes(value);
};
const getUserId = (req) => {
    if (!req.user) {
        throw new error_middleware_1.AppError("Silakan login terlebih dahulu.", 401);
    }
    return req.user.id;
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
    return slug || "item";
};
const createUniqueProductSlug = async (storeId, name, ignoreProductId) => {
    const baseSlug = slugify(name);
    let slug = baseSlug;
    let counter = 1;
    while (true) {
        const existingProduct = await prisma_1.default.product.findFirst({
            where: {
                storeId,
                slug,
                ...(ignoreProductId
                    ? {
                        NOT: {
                            id: ignoreProductId,
                        },
                    }
                    : {}),
            },
            select: {
                id: true,
            },
        });
        if (!existingProduct) {
            return slug;
        }
        counter += 1;
        slug = `${baseSlug}-${counter}`;
    }
};
const createUniqueCategorySlug = async (name, ignoreCategoryId) => {
    const baseSlug = slugify(name);
    let slug = baseSlug;
    let counter = 1;
    while (true) {
        const existingCategory = await prisma_1.default.category.findFirst({
            where: {
                slug,
                ...(ignoreCategoryId
                    ? {
                        NOT: {
                            id: ignoreCategoryId,
                        },
                    }
                    : {}),
            },
            select: {
                id: true,
            },
        });
        if (!existingCategory) {
            return slug;
        }
        counter += 1;
        slug = `${baseSlug}-${counter}`;
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
    if (store.status !== client_1.StoreStatus.ACTIVE) {
        throw new error_middleware_1.AppError("Toko kamu sedang tidak aktif.", 400);
    }
    return store;
};
const normalizeProduct = (product) => {
    const reviews = product.productReviews || [];
    const averageRating = reviews.length > 0
        ? reviews.reduce((total, review) => total + review.rating, 0) /
            reviews.length
        : null;
    return {
        ...product,
        price: Number(product.price),
        averageRating: averageRating === null ? null : Number(averageRating.toFixed(1)),
        totalReviews: product._count?.productReviews ?? reviews.length ?? 0,
    };
};
const productListInclude = {
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
    _count: {
        select: {
            productReviews: true,
            orderItems: true,
            cartItems: true,
        },
    },
};
const productDetailInclude = {
    store: {
        select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            logoUrl: true,
            address: true,
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
    productReviews: {
        orderBy: {
            createdAt: "desc",
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
    },
    _count: {
        select: {
            productReviews: true,
            orderItems: true,
            cartItems: true,
        },
    },
};
const getAllProducts = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPagination(req);
        const search = (0, sanitize_1.sanitizeSearchQuery)(req.query.search);
        const categoryId = req.query.categoryId;
        const categorySlug = req.query.categorySlug;
        const storeId = req.query.storeId;
        const storeSlug = req.query.storeSlug;
        const minPrice = req.query.minPrice;
        const maxPrice = req.query.maxPrice;
        const sort = String(req.query.sort || "latest");
        const where = {
            status: client_1.ProductStatus.ACTIVE,
            store: {
                status: client_1.StoreStatus.ACTIVE,
            },
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
        if (categorySlug) {
            const cleanCategorySlug = (0, sanitize_1.sanitizeText)(categorySlug, {
                maxLength: 120,
                trim: true,
                allowNewLines: false,
            });
            where.category = {
                is: {
                    slug: cleanCategorySlug,
                },
            };
        }
        if (storeId) {
            where.storeId = parseIdParam(storeId, "Store ID");
        }
        if (storeSlug) {
            const cleanStoreSlug = (0, sanitize_1.sanitizeText)(storeSlug, {
                maxLength: 180,
                trim: true,
                allowNewLines: false,
            });
            where.store = {
                status: client_1.StoreStatus.ACTIVE,
                slug: cleanStoreSlug,
            };
        }
        if (minPrice || maxPrice) {
            const priceFilter = {};
            if (minPrice) {
                priceFilter.gte = parsePrice(minPrice, "Minimal harga");
            }
            if (maxPrice) {
                priceFilter.lte = parsePrice(maxPrice, "Maksimal harga");
            }
            where.price = priceFilter;
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
                include: productListInclude,
            }),
            prisma_1.default.product.count({
                where,
            }),
        ]);
        return res.status(200).json({
            success: true,
            message: "Data produk berhasil diambil.",
            data: products.map(normalizeProduct),
            meta: createPaginationMeta(page, limit, total),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getAllProducts = getAllProducts;
const getProductById = async (req, res, next) => {
    try {
        const productId = parseIdParam(req.params.id, "Product ID");
        const product = await prisma_1.default.product.findFirst({
            where: {
                id: productId,
                status: client_1.ProductStatus.ACTIVE,
                store: {
                    status: client_1.StoreStatus.ACTIVE,
                },
            },
            include: productDetailInclude,
        });
        if (!product) {
            throw new error_middleware_1.AppError("Produk tidak ditemukan.", 404);
        }
        return res.status(200).json({
            success: true,
            message: "Detail produk berhasil diambil.",
            data: normalizeProduct(product),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getProductById = getProductById;
const getProductBySlug = async (req, res, next) => {
    try {
        const slug = (0, sanitize_1.sanitizeText)(req.params.slug, {
            maxLength: 180,
            trim: true,
            allowNewLines: false,
        });
        if (!slug) {
            throw new error_middleware_1.AppError("Slug produk tidak valid.", 400);
        }
        const product = await prisma_1.default.product.findFirst({
            where: {
                slug,
                status: client_1.ProductStatus.ACTIVE,
                store: {
                    status: client_1.StoreStatus.ACTIVE,
                },
            },
            include: productDetailInclude,
        });
        if (!product) {
            throw new error_middleware_1.AppError("Produk tidak ditemukan.", 404);
        }
        return res.status(200).json({
            success: true,
            message: "Detail produk berhasil diambil.",
            data: normalizeProduct(product),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getProductBySlug = getProductBySlug;
const getSellerProducts = async (req, res, next) => {
    try {
        const sellerId = getUserId(req);
        const store = await getSellerStore(sellerId);
        const { page, limit, skip } = getPagination(req);
        const search = (0, sanitize_1.sanitizeSearchQuery)(req.query.search);
        const { status, categoryId } = req.query;
        const where = {
            storeId: store.id,
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
        if (status) {
            if (!isValidEnumValue(client_1.ProductStatus, status)) {
                throw new error_middleware_1.AppError("Status produk tidak valid.", 400);
            }
            where.status = status;
        }
        if (categoryId) {
            where.categoryId = parseIdParam(categoryId, "Category ID");
        }
        const [products, total] = await prisma_1.default.$transaction([
            prisma_1.default.product.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    createdAt: "desc",
                },
                include: productListInclude,
            }),
            prisma_1.default.product.count({
                where,
            }),
        ]);
        return res.status(200).json({
            success: true,
            message: "Data produk seller berhasil diambil.",
            data: products.map(normalizeProduct),
            meta: createPaginationMeta(page, limit, total),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getSellerProducts = getSellerProducts;
const createProduct = async (req, res, next) => {
    try {
        const sellerId = getUserId(req);
        const store = await getSellerStore(sellerId);
        const { name, description, price, stock, imageUrl, categoryId, status, } = req.body;
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
        const cleanImageUrl = (0, sanitize_1.sanitizeUrl)(imageUrl, {
            maxLength: 1000,
        });
        if (!cleanName) {
            throw new error_middleware_1.AppError("Nama produk wajib diisi.", 400);
        }
        const cleanPrice = parsePrice(price);
        const cleanStock = parseStock(stock);
        if (cleanPrice <= 0) {
            throw new error_middleware_1.AppError("Harga produk harus lebih dari 0.", 400);
        }
        let cleanCategoryId = null;
        if (categoryId !== undefined && categoryId !== null && categoryId !== "") {
            cleanCategoryId = parseIdParam(categoryId, "Category ID");
            const category = await prisma_1.default.category.findUnique({
                where: {
                    id: cleanCategoryId,
                },
                select: {
                    id: true,
                },
            });
            if (!category) {
                throw new error_middleware_1.AppError("Kategori tidak ditemukan.", 404);
            }
        }
        let productStatus = cleanStock === 0 ? client_1.ProductStatus.OUT_OF_STOCK : client_1.ProductStatus.ACTIVE;
        if (status) {
            if (!isValidEnumValue(client_1.ProductStatus, status)) {
                throw new error_middleware_1.AppError("Status produk tidak valid.", 400);
            }
            productStatus = status;
            if (cleanStock === 0 && productStatus === client_1.ProductStatus.ACTIVE) {
                productStatus = client_1.ProductStatus.OUT_OF_STOCK;
            }
        }
        const slug = await createUniqueProductSlug(store.id, cleanName);
        const product = await prisma_1.default.product.create({
            data: {
                name: cleanName,
                slug,
                description: cleanDescription,
                price: cleanPrice,
                stock: cleanStock,
                imageUrl: cleanImageUrl,
                status: productStatus,
                storeId: store.id,
                categoryId: cleanCategoryId,
            },
            include: productDetailInclude,
        });
        return res.status(201).json({
            success: true,
            message: "Produk berhasil dibuat.",
            data: normalizeProduct(product),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createProduct = createProduct;
const updateProduct = async (req, res, next) => {
    try {
        const sellerId = getUserId(req);
        const store = await getSellerStore(sellerId);
        const productId = parseIdParam(req.params.id, "Product ID");
        const product = await prisma_1.default.product.findFirst({
            where: {
                id: productId,
                storeId: store.id,
            },
        });
        if (!product) {
            throw new error_middleware_1.AppError("Produk tidak ditemukan atau bukan milik toko kamu.", 404);
        }
        const { name, description, price, stock, imageUrl, categoryId, status, } = req.body;
        const updateData = {};
        if (name !== undefined) {
            const cleanName = (0, sanitize_1.sanitizeText)(name, {
                maxLength: 150,
                trim: true,
                allowNewLines: false,
            });
            if (!cleanName) {
                throw new error_middleware_1.AppError("Nama produk tidak boleh kosong.", 400);
            }
            updateData.name = cleanName;
            updateData.slug = await createUniqueProductSlug(store.id, cleanName, product.id);
        }
        if (description !== undefined) {
            updateData.description = (0, sanitize_1.sanitizeNullableText)(description, {
                maxLength: 2000,
                trim: true,
                allowNewLines: true,
            });
        }
        if (price !== undefined) {
            const cleanPrice = parsePrice(price);
            if (cleanPrice <= 0) {
                throw new error_middleware_1.AppError("Harga produk harus lebih dari 0.", 400);
            }
            updateData.price = cleanPrice;
        }
        if (stock !== undefined) {
            const cleanStock = parseStock(stock);
            updateData.stock = cleanStock;
            if (cleanStock === 0) {
                updateData.status = client_1.ProductStatus.OUT_OF_STOCK;
            }
            if (cleanStock > 0 && product.status === client_1.ProductStatus.OUT_OF_STOCK) {
                updateData.status = client_1.ProductStatus.ACTIVE;
            }
        }
        if (imageUrl !== undefined) {
            updateData.imageUrl = (0, sanitize_1.sanitizeUrl)(imageUrl, {
                maxLength: 1000,
            });
        }
        if (categoryId !== undefined) {
            if (categoryId === null || categoryId === "") {
                updateData.categoryId = null;
            }
            else {
                const cleanCategoryId = parseIdParam(categoryId, "Category ID");
                const category = await prisma_1.default.category.findUnique({
                    where: {
                        id: cleanCategoryId,
                    },
                    select: {
                        id: true,
                    },
                });
                if (!category) {
                    throw new error_middleware_1.AppError("Kategori tidak ditemukan.", 404);
                }
                updateData.categoryId = cleanCategoryId;
            }
        }
        if (status !== undefined) {
            if (!isValidEnumValue(client_1.ProductStatus, status)) {
                throw new error_middleware_1.AppError("Status produk tidak valid.", 400);
            }
            updateData.status = status;
            const finalStock = typeof updateData.stock === "number" ? updateData.stock : product.stock;
            if (finalStock === 0 && status === client_1.ProductStatus.ACTIVE) {
                updateData.status = client_1.ProductStatus.OUT_OF_STOCK;
            }
        }
        const updatedProduct = await prisma_1.default.product.update({
            where: {
                id: productId,
            },
            data: updateData,
            include: productDetailInclude,
        });
        return res.status(200).json({
            success: true,
            message: "Produk berhasil diperbarui.",
            data: normalizeProduct(updatedProduct),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateProduct = updateProduct;
const deleteProduct = async (req, res, next) => {
    try {
        const sellerId = getUserId(req);
        const store = await getSellerStore(sellerId);
        const productId = parseIdParam(req.params.id, "Product ID");
        const product = await prisma_1.default.product.findFirst({
            where: {
                id: productId,
                storeId: store.id,
            },
            select: {
                id: true,
            },
        });
        if (!product) {
            throw new error_middleware_1.AppError("Produk tidak ditemukan atau bukan milik toko kamu.", 404);
        }
        await prisma_1.default.product.delete({
            where: {
                id: productId,
            },
        });
        return res.status(200).json({
            success: true,
            message: "Produk berhasil dihapus.",
        });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteProduct = deleteProduct;
const getCategories = async (_req, res, next) => {
    try {
        const categories = await prisma_1.default.category.findMany({
            orderBy: {
                name: "asc",
            },
            include: {
                _count: {
                    select: {
                        products: true,
                    },
                },
            },
        });
        return res.status(200).json({
            success: true,
            message: "Data kategori berhasil diambil.",
            data: categories,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getCategories = getCategories;
const createCategory = async (req, res, next) => {
    try {
        const cleanName = (0, sanitize_1.sanitizeText)(req.body.name, {
            maxLength: 100,
            trim: true,
            allowNewLines: false,
        });
        if (!cleanName) {
            throw new error_middleware_1.AppError("Nama kategori wajib diisi.", 400);
        }
        const existingCategory = await prisma_1.default.category.findUnique({
            where: {
                name: cleanName,
            },
            select: {
                id: true,
            },
        });
        if (existingCategory) {
            throw new error_middleware_1.AppError("Nama kategori sudah digunakan.", 409);
        }
        const slug = await createUniqueCategorySlug(cleanName);
        const category = await prisma_1.default.category.create({
            data: {
                name: cleanName,
                slug,
            },
        });
        return res.status(201).json({
            success: true,
            message: "Kategori berhasil dibuat.",
            data: category,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createCategory = createCategory;
const updateCategory = async (req, res, next) => {
    try {
        const categoryId = parseIdParam(req.params.id, "Category ID");
        const cleanName = (0, sanitize_1.sanitizeText)(req.body.name, {
            maxLength: 100,
            trim: true,
            allowNewLines: false,
        });
        if (!cleanName) {
            throw new error_middleware_1.AppError("Nama kategori wajib diisi.", 400);
        }
        const category = await prisma_1.default.category.findUnique({
            where: {
                id: categoryId,
            },
            select: {
                id: true,
            },
        });
        if (!category) {
            throw new error_middleware_1.AppError("Kategori tidak ditemukan.", 404);
        }
        const existingCategory = await prisma_1.default.category.findFirst({
            where: {
                name: cleanName,
                NOT: {
                    id: categoryId,
                },
            },
            select: {
                id: true,
            },
        });
        if (existingCategory) {
            throw new error_middleware_1.AppError("Nama kategori sudah digunakan.", 409);
        }
        const slug = await createUniqueCategorySlug(cleanName, categoryId);
        const updatedCategory = await prisma_1.default.category.update({
            where: {
                id: categoryId,
            },
            data: {
                name: cleanName,
                slug,
            },
        });
        return res.status(200).json({
            success: true,
            message: "Kategori berhasil diperbarui.",
            data: updatedCategory,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateCategory = updateCategory;
const deleteCategory = async (req, res, next) => {
    try {
        const categoryId = parseIdParam(req.params.id, "Category ID");
        const category = await prisma_1.default.category.findUnique({
            where: {
                id: categoryId,
            },
            select: {
                id: true,
            },
        });
        if (!category) {
            throw new error_middleware_1.AppError("Kategori tidak ditemukan.", 404);
        }
        await prisma_1.default.category.delete({
            where: {
                id: categoryId,
            },
        });
        return res.status(200).json({
            success: true,
            message: "Kategori berhasil dihapus.",
        });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteCategory = deleteCategory;
