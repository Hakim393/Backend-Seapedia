import type { NextFunction, Request, Response } from "express";
import { Prisma, ProductStatus, StoreStatus } from "@prisma/client";
import prisma from "../config/prisma";
import { AppError } from "../middleware/error.middleware";
import { sanitizeReviewComment } from "../utils/sanitize";

const getUserId = (req: Request) => {
  if (!req.user) {
    throw new AppError("Silakan login terlebih dahulu.", 401);
  }

  return req.user.id;
};

const parseIdParam = (value: unknown, paramName = "id") => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new AppError(`${paramName} tidak valid.`, 400);
  }

  return parsed;
};

const parsePositiveInt = (
  value: unknown,
  defaultValue: number,
  maxValue?: number
) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return defaultValue;
  }

  if (maxValue && parsed > maxValue) {
    return maxValue;
  }

  return parsed;
};

const getPagination = (req: Request) => {
  const page = parsePositiveInt(req.query.page, 1);
  const limit = parsePositiveInt(req.query.limit, 10, 100);
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
  };
};

const createPaginationMeta = (page: number, limit: number, total: number) => {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
};

const parseRating = (value: unknown) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
    throw new AppError("Rating harus berupa angka 1 sampai 5.", 400);
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

export const getProductReviews = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const productId = parseIdParam(req.params.productId, "Product ID");
    const { page, limit, skip } = getPagination(req);

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        status: ProductStatus.ACTIVE,
        store: {
          status: StoreStatus.ACTIVE,
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    if (!product) {
      throw new AppError("Produk tidak ditemukan.", 404);
    }

    const [reviews, total, ratingAggregate] = await prisma.$transaction([
      prisma.productReview.findMany({
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
      prisma.productReview.count({
        where: {
          productId,
        },
      }),
      prisma.productReview.aggregate({
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
  } catch (error) {
    next(error);
  }
};

export const createProductReview = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getUserId(req);
    const productId = parseIdParam(
      req.params.productId || req.body.productId,
      "Product ID"
    );

    const rating = parseRating(req.body.rating);
    const comment = sanitizeReviewComment(req.body.comment);

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        status: ProductStatus.ACTIVE,
        store: {
          status: StoreStatus.ACTIVE,
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!product) {
      throw new AppError("Produk tidak ditemukan atau tidak aktif.", 404);
    }

    const existingReview = await prisma.productReview.findUnique({
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
      throw new AppError(
        "Kamu sudah pernah memberikan review untuk produk ini.",
        409
      );
    }

    const review = await prisma.productReview.create({
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
  } catch (error) {
    next(error);
  }
};

export const getMyProductReviews = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getUserId(req);
    const { page, limit, skip } = getPagination(req);

    const [reviews, total] = await prisma.$transaction([
      prisma.productReview.findMany({
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
      prisma.productReview.count({
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
  } catch (error) {
    next(error);
  }
};

export const updateMyProductReview = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getUserId(req);
    const reviewId = parseIdParam(req.params.id, "Review ID");

    const review = await prisma.productReview.findFirst({
      where: {
        id: reviewId,
        userId,
      },
      select: {
        id: true,
      },
    });

    if (!review) {
      throw new AppError("Review produk tidak ditemukan.", 404);
    }

    const updateData: Prisma.ProductReviewUpdateInput = {};

    if (req.body.rating !== undefined) {
      updateData.rating = parseRating(req.body.rating);
    }

    if (req.body.comment !== undefined) {
      updateData.comment = sanitizeReviewComment(req.body.comment);
    }

    if (Object.keys(updateData).length === 0) {
      throw new AppError("Tidak ada data yang diperbarui.", 400);
    }

    const updatedReview = await prisma.productReview.update({
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
  } catch (error) {
    next(error);
  }
};

export const deleteMyProductReview = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getUserId(req);
    const reviewId = parseIdParam(req.params.id, "Review ID");

    const review = await prisma.productReview.findFirst({
      where: {
        id: reviewId,
        userId,
      },
      select: {
        id: true,
      },
    });

    if (!review) {
      throw new AppError("Review produk tidak ditemukan.", 404);
    }

    await prisma.productReview.delete({
      where: {
        id: reviewId,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Review produk berhasil dihapus.",
    });
  } catch (error) {
    next(error);
  }
};

export const getApplicationReviews = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { page, limit, skip } = getPagination(req);

    const [reviews, total, ratingAggregate] = await prisma.$transaction([
      prisma.applicationReview.findMany({
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
        include: applicationReviewInclude,
      }),
      prisma.applicationReview.count(),
      prisma.applicationReview.aggregate({
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
  } catch (error) {
    next(error);
  }
};

export const createApplicationReview = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getUserId(req);
    const rating = parseRating(req.body.rating);
    const comment = sanitizeReviewComment(req.body.comment);

    const review = await prisma.applicationReview.create({
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
  } catch (error) {
    next(error);
  }
};

export const getMyApplicationReviews = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getUserId(req);
    const { page, limit, skip } = getPagination(req);

    const [reviews, total] = await prisma.$transaction([
      prisma.applicationReview.findMany({
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
      prisma.applicationReview.count({
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
  } catch (error) {
    next(error);
  }
};

export const updateMyApplicationReview = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getUserId(req);
    const reviewId = parseIdParam(req.params.id, "Application Review ID");

    const review = await prisma.applicationReview.findFirst({
      where: {
        id: reviewId,
        userId,
      },
      select: {
        id: true,
      },
    });

    if (!review) {
      throw new AppError("Review aplikasi tidak ditemukan.", 404);
    }

    const updateData: Prisma.ApplicationReviewUpdateInput = {};

    if (req.body.rating !== undefined) {
      updateData.rating = parseRating(req.body.rating);
    }

    if (req.body.comment !== undefined) {
      updateData.comment = sanitizeReviewComment(req.body.comment);
    }

    if (Object.keys(updateData).length === 0) {
      throw new AppError("Tidak ada data yang diperbarui.", 400);
    }

    const updatedReview = await prisma.applicationReview.update({
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
  } catch (error) {
    next(error);
  }
};

export const deleteMyApplicationReview = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getUserId(req);
    const reviewId = parseIdParam(req.params.id, "Application Review ID");

    const review = await prisma.applicationReview.findFirst({
      where: {
        id: reviewId,
        userId,
      },
      select: {
        id: true,
      },
    });

    if (!review) {
      throw new AppError("Review aplikasi tidak ditemukan.", 404);
    }

    await prisma.applicationReview.delete({
      where: {
        id: reviewId,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Review aplikasi berhasil dihapus.",
    });
  } catch (error) {
    next(error);
  }
};