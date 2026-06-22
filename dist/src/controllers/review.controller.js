"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMyApplicationReview = exports.updateMyApplicationReview = exports.getMyApplicationReviews = exports.createApplicationReview = exports.getApplicationReviews = exports.deleteMyProductReview = exports.updateMyProductReview = exports.getMyProductReviews = exports.createProductReview = exports.getProductReviews = void 0;
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
const parseRating = (value) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
        throw new error_middleware_1.AppError("Rating harus berupa angka 1 sampai 5.", 400);
    }
    return parsed;
};
const productReviewInclude = {
    user: {
        select: {
            id: true,
            name: true,
        },
    },
    product: {
        select: {
            id: true,
            name: true,
            slug: true,
            imageUrl: true,
            store: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                },
            },
        },
    },
};
const applicationReviewInclude = {
    user: {
        select: {
            id: true,
            name: true,
        },
    },
};
const getProductReviews = async (req, res, next) => {
    try {
        const productId = parseIdParam(req.params.productId, "Product ID");
        const { page, limit, skip } = getPagination(req);
        const product = await prisma_1.default.product.findFirst({
            where: {
                id: productId,
                status: client_1.ProductStatus.ACTIVE,
                store: {
                    status: client_1.StoreStatus.ACTIVE,
                },
            },
            select: {
                id: true,
                name: true,
                slug: true,
            },
        });
        if (!product) {
            throw new error_middleware_1.AppError("Produk tidak ditemukan.", 404);
        }
        const [reviews, total, ratingAggregate] = await prisma_1.default.$transaction([
            prisma_1.default.productReview.findMany({
                where: {
                    productId,
                },
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
                        },
                    },
                },
            }),
            prisma_1.default.productReview.count({
                where: {
                    productId,
                },
            }),
            prisma_1.default.productReview.aggregate({
                where: {
                    productId,
                },
                _avg: {
                    rating: true,
                },
            }),
        ]);
        return res.status(200).json({
            success: true,
            message: "Data review produk berhasil diambil.",
            data: {
                product,
                averageRating: ratingAggregate._avg.rating
                    ? Number(ratingAggregate._avg.rating.toFixed(1))
                    : null,
                totalReviews: total,
                reviews,
            },
            meta: createPaginationMeta(page, limit, total),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getProductReviews = getProductReviews;
const createProductReview = async (req, res, next) => {
    try {
        const userId = getUserId(req);
        const productId = parseIdParam(req.params.productId || req.body.productId, "Product ID");
        const rating = parseRating(req.body.rating);
        const comment = (0, sanitize_1.sanitizeReviewComment)(req.body.comment);
        const product = await prisma_1.default.product.findFirst({
            where: {
                id: productId,
                status: client_1.ProductStatus.ACTIVE,
                store: {
                    status: client_1.StoreStatus.ACTIVE,
                },
            },
            select: {
                id: true,
                name: true,
            },
        });
        if (!product) {
            throw new error_middleware_1.AppError("Produk tidak ditemukan atau tidak aktif.", 404);
        }
        const existingReview = await prisma_1.default.productReview.findUnique({
            where: {
                userId_productId: {
                    userId,
                    productId,
                },
            },
            select: {
                id: true,
            },
        });
        if (existingReview) {
            throw new error_middleware_1.AppError("Kamu sudah pernah memberikan review untuk produk ini.", 409);
        }
        const review = await prisma_1.default.productReview.create({
            data: {
                userId,
                productId,
                rating,
                comment,
            },
            include: productReviewInclude,
        });
        return res.status(201).json({
            success: true,
            message: "Review produk berhasil dibuat.",
            data: review,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createProductReview = createProductReview;
const getMyProductReviews = async (req, res, next) => {
    try {
        const userId = getUserId(req);
        const { page, limit, skip } = getPagination(req);
        const [reviews, total] = await prisma_1.default.$transaction([
            prisma_1.default.productReview.findMany({
                where: {
                    userId,
                },
                skip,
                take: limit,
                orderBy: {
                    createdAt: "desc",
                },
                include: productReviewInclude,
            }),
            prisma_1.default.productReview.count({
                where: {
                    userId,
                },
            }),
        ]);
        return res.status(200).json({
            success: true,
            message: "Data review produk milik user berhasil diambil.",
            data: reviews,
            meta: createPaginationMeta(page, limit, total),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getMyProductReviews = getMyProductReviews;
const updateMyProductReview = async (req, res, next) => {
    try {
        const userId = getUserId(req);
        const reviewId = parseIdParam(req.params.id, "Review ID");
        const review = await prisma_1.default.productReview.findFirst({
            where: {
                id: reviewId,
                userId,
            },
            select: {
                id: true,
            },
        });
        if (!review) {
            throw new error_middleware_1.AppError("Review produk tidak ditemukan.", 404);
        }
        const updateData = {};
        if (req.body.rating !== undefined) {
            updateData.rating = parseRating(req.body.rating);
        }
        if (req.body.comment !== undefined) {
            updateData.comment = (0, sanitize_1.sanitizeReviewComment)(req.body.comment);
        }
        if (Object.keys(updateData).length === 0) {
            throw new error_middleware_1.AppError("Tidak ada data yang diperbarui.", 400);
        }
        const updatedReview = await prisma_1.default.productReview.update({
            where: {
                id: reviewId,
            },
            data: updateData,
            include: productReviewInclude,
        });
        return res.status(200).json({
            success: true,
            message: "Review produk berhasil diperbarui.",
            data: updatedReview,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateMyProductReview = updateMyProductReview;
const deleteMyProductReview = async (req, res, next) => {
    try {
        const userId = getUserId(req);
        const reviewId = parseIdParam(req.params.id, "Review ID");
        const review = await prisma_1.default.productReview.findFirst({
            where: {
                id: reviewId,
                userId,
            },
            select: {
                id: true,
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
exports.deleteMyProductReview = deleteMyProductReview;
const getApplicationReviews = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPagination(req);
        const [reviews, total, ratingAggregate] = await prisma_1.default.$transaction([
            prisma_1.default.applicationReview.findMany({
                skip,
                take: limit,
                orderBy: {
                    createdAt: "desc",
                },
                include: applicationReviewInclude,
            }),
            prisma_1.default.applicationReview.count(),
            prisma_1.default.applicationReview.aggregate({
                _avg: {
                    rating: true,
                },
            }),
        ]);
        return res.status(200).json({
            success: true,
            message: "Data review aplikasi berhasil diambil.",
            data: {
                averageRating: ratingAggregate._avg.rating
                    ? Number(ratingAggregate._avg.rating.toFixed(1))
                    : null,
                totalReviews: total,
                reviews,
            },
            meta: createPaginationMeta(page, limit, total),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getApplicationReviews = getApplicationReviews;
const createApplicationReview = async (req, res, next) => {
    try {
        const userId = getUserId(req);
        const rating = parseRating(req.body.rating);
        const comment = (0, sanitize_1.sanitizeReviewComment)(req.body.comment);
        const review = await prisma_1.default.applicationReview.create({
            data: {
                userId,
                rating,
                comment,
            },
            include: applicationReviewInclude,
        });
        return res.status(201).json({
            success: true,
            message: "Review aplikasi berhasil dibuat.",
            data: review,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createApplicationReview = createApplicationReview;
const getMyApplicationReviews = async (req, res, next) => {
    try {
        const userId = getUserId(req);
        const { page, limit, skip } = getPagination(req);
        const [reviews, total] = await prisma_1.default.$transaction([
            prisma_1.default.applicationReview.findMany({
                where: {
                    userId,
                },
                skip,
                take: limit,
                orderBy: {
                    createdAt: "desc",
                },
                include: applicationReviewInclude,
            }),
            prisma_1.default.applicationReview.count({
                where: {
                    userId,
                },
            }),
        ]);
        return res.status(200).json({
            success: true,
            message: "Data review aplikasi milik user berhasil diambil.",
            data: reviews,
            meta: createPaginationMeta(page, limit, total),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getMyApplicationReviews = getMyApplicationReviews;
const updateMyApplicationReview = async (req, res, next) => {
    try {
        const userId = getUserId(req);
        const reviewId = parseIdParam(req.params.id, "Application Review ID");
        const review = await prisma_1.default.applicationReview.findFirst({
            where: {
                id: reviewId,
                userId,
            },
            select: {
                id: true,
            },
        });
        if (!review) {
            throw new error_middleware_1.AppError("Review aplikasi tidak ditemukan.", 404);
        }
        const updateData = {};
        if (req.body.rating !== undefined) {
            updateData.rating = parseRating(req.body.rating);
        }
        if (req.body.comment !== undefined) {
            updateData.comment = (0, sanitize_1.sanitizeReviewComment)(req.body.comment);
        }
        if (Object.keys(updateData).length === 0) {
            throw new error_middleware_1.AppError("Tidak ada data yang diperbarui.", 400);
        }
        const updatedReview = await prisma_1.default.applicationReview.update({
            where: {
                id: reviewId,
            },
            data: updateData,
            include: applicationReviewInclude,
        });
        return res.status(200).json({
            success: true,
            message: "Review aplikasi berhasil diperbarui.",
            data: updatedReview,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateMyApplicationReview = updateMyApplicationReview;
const deleteMyApplicationReview = async (req, res, next) => {
    try {
        const userId = getUserId(req);
        const reviewId = parseIdParam(req.params.id, "Application Review ID");
        const review = await prisma_1.default.applicationReview.findFirst({
            where: {
                id: reviewId,
                userId,
            },
            select: {
                id: true,
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
exports.deleteMyApplicationReview = deleteMyApplicationReview;
