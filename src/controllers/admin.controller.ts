import type { NextFunction, Request, Response } from "express";
import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  ProductStatus,
  Role,
  StoreStatus,
} from "@prisma/client";
import prisma from "../config/prisma";
import { AppError } from "../middleware/error.middleware";

const parsePositiveInt = (
  value: unknown,
  defaultValue: number,
  maxValue?: number,
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

const getIdParam = (value: unknown, paramName = "id") => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new AppError(`${paramName} tidak valid.`, 400);
  }

  return parsed;
};

const getSearchQuery = (value: unknown) => {
  if (!value) return "";

  return String(value).trim();
};

const isValidEnumValue = <T extends Record<string, string>>(
  enumObject: T,
  value: unknown,
): value is T[keyof T] => {
  return typeof value === "string" && Object.values(enumObject).includes(value);
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

export const getAdminDashboard = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const [
      totalUsers,
      totalBuyers,
      totalSellers,
      totalAdmins,
      totalStores,
      totalProducts,
      totalOrders,
      totalProductReviews,
      totalApplicationReviews,
      revenueAggregate,
      ordersByStatus,
      storesByStatus,
      productsByStatus,
      latestOrders,
      lowStockProducts,
    ] = await prisma.$transaction([
      prisma.user.count(),
      prisma.user.count({
        where: {
          role: Role.USER,
        },
      }),
      prisma.user.count({
        where: {
          role: Role.SELLER,
        },
      }),
      prisma.user.count({
        where: {
          role: Role.ADMIN,
        },
      }),
      prisma.store.count(),
      prisma.product.count(),
      prisma.order.count(),
      prisma.productReview.count(),
      prisma.applicationReview.count(),
      prisma.order.aggregate({
        where: {
          paymentStatus: PaymentStatus.PAID,
        },
        _sum: {
          totalAmount: true,
        },
      }),
      prisma.order.groupBy({
        by: ["status"],
        _count: {
          status: true,
        },
        orderBy: {
          status: "asc",
        },
      }),
      prisma.store.groupBy({
        by: ["status"],
        _count: {
          status: true,
        },
        orderBy: {
          status: "asc",
        },
      }),
      prisma.product.groupBy({
        by: ["status"],
        _count: {
          status: true,
        },
        orderBy: {
          status: "asc",
        },
      }),
      prisma.order.findMany({
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
      prisma.product.findMany({
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
  } catch (error) {
    next(error);
  }
};

export const getAllUsers = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page, limit, skip } = getPagination(req);
    const search = getSearchQuery(req.query.search);
    const { role } = req.query;

    const where: Prisma.UserWhereInput = {};

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
      if (!isValidEnumValue(Role, role)) {
        throw new AppError("Role tidak valid.", 400);
      }

      where.role = role;
    }

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
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
      prisma.user.count({
        where,
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Data user berhasil diambil.",
      data: users,
      meta: createPaginationMeta(page, limit, total),
    });
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = getIdParam(req.params.id, "User ID");

    const user = await prisma.user.findUnique({
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
      throw new AppError("User tidak ditemukan.", 404);
    }

    return res.status(200).json({
      success: true,
      message: "Detail user berhasil diambil.",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserRole = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = getIdParam(req.params.id, "User ID");
    const { role } = req.body;

    if (!isValidEnumValue(Role, role)) {
      throw new AppError("Role tidak valid.", 400);
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!user) {
      throw new AppError("User tidak ditemukan.", 404);
    }

    if (user.role === Role.ADMIN && role !== Role.ADMIN) {
      const totalAdmin = await prisma.user.count({
        where: {
          role: Role.ADMIN,
        },
      });

      if (totalAdmin <= 1) {
        throw new AppError("Tidak bisa mengubah role admin terakhir.", 400);
      }
    }

    const updatedUser = await prisma.user.update({
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
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = getIdParam(req.params.id, "User ID");

    if (req.user?.id === userId) {
      throw new AppError("Kamu tidak bisa menghapus akun sendiri.", 400);
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!user) {
      throw new AppError("User tidak ditemukan.", 404);
    }

    if (user.role === Role.ADMIN) {
      const totalAdmin = await prisma.user.count({
        where: {
          role: Role.ADMIN,
        },
      });

      if (totalAdmin <= 1) {
        throw new AppError("Tidak bisa menghapus admin terakhir.", 400);
      }
    }

    await prisma.user.delete({
      where: {
        id: userId,
      },
    });

    return res.status(200).json({
      success: true,
      message: "User berhasil dihapus.",
    });
  } catch (error) {
    next(error);
  }
};

export const getAllStoresForAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page, limit, skip } = getPagination(req);
    const search = getSearchQuery(req.query.search);
    const { status } = req.query;

    const where: Prisma.StoreWhereInput = {};

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
      if (!isValidEnumValue(StoreStatus, status)) {
        throw new AppError("Status toko tidak valid.", 400);
      }

      where.status = status;
    }

    const [stores, total] = await prisma.$transaction([
      prisma.store.findMany({
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
      prisma.store.count({
        where,
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Data toko berhasil diambil.",
      data: stores,
      meta: createPaginationMeta(page, limit, total),
    });
  } catch (error) {
    next(error);
  }
};

export const updateStoreStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const storeId = getIdParam(req.params.id, "Store ID");
    const { status } = req.body;

    if (!isValidEnumValue(StoreStatus, status)) {
      throw new AppError("Status toko tidak valid.", 400);
    }

    const store = await prisma.store.findUnique({
      where: {
        id: storeId,
      },
    });

    if (!store) {
      throw new AppError("Toko tidak ditemukan.", 404);
    }

    const updatedStore = await prisma.store.update({
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
  } catch (error) {
    next(error);
  }
};

export const getAllProductsForAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page, limit, skip } = getPagination(req);
    const search = getSearchQuery(req.query.search);
    const { status, storeId, categoryId } = req.query;

    const where: Prisma.ProductWhereInput = {};

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
      if (!isValidEnumValue(ProductStatus, status)) {
        throw new AppError("Status produk tidak valid.", 400);
      }

      where.status = status;
    }

    if (storeId) {
      where.storeId = getIdParam(storeId, "Store ID");
    }

    if (categoryId) {
      where.categoryId = getIdParam(categoryId, "Category ID");
    }

    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
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
      prisma.product.count({
        where,
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Data produk berhasil diambil.",
      data: products,
      meta: createPaginationMeta(page, limit, total),
    });
  } catch (error) {
    next(error);
  }
};

export const updateProductStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const productId = getIdParam(req.params.id, "Product ID");
    const { status } = req.body;

    if (!isValidEnumValue(ProductStatus, status)) {
      throw new AppError("Status produk tidak valid.", 400);
    }

    const product = await prisma.product.findUnique({
      where: {
        id: productId,
      },
    });

    if (!product) {
      throw new AppError("Produk tidak ditemukan.", 404);
    }

    const updatedProduct = await prisma.product.update({
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
  } catch (error) {
    next(error);
  }
};

export const getAllOrdersForAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page, limit, skip } = getPagination(req);
    const { status, paymentStatus, storeId, userId } = req.query;

    const where: Prisma.OrderWhereInput = {};

    if (status) {
      if (!isValidEnumValue(OrderStatus, status)) {
        throw new AppError("Status pesanan tidak valid.", 400);
      }

      where.status = status;
    }

    if (paymentStatus) {
      if (!isValidEnumValue(PaymentStatus, paymentStatus)) {
        throw new AppError("Status pembayaran tidak valid.", 400);
      }

      where.paymentStatus = paymentStatus;
    }

    if (storeId) {
      where.storeId = getIdParam(storeId, "Store ID");
    }

    if (userId) {
      where.userId = getIdParam(userId, "User ID");
    }

    const [orders, total] = await prisma.$transaction([
      prisma.order.findMany({
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
      prisma.order.count({
        where,
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Data pesanan berhasil diambil.",
      data: orders,
      meta: createPaginationMeta(page, limit, total),
    });
  } catch (error) {
    next(error);
  }
};

export const getOrderDetailForAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const orderId = getIdParam(req.params.id, "Order ID");

    const order = await prisma.order.findUnique({
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
      throw new AppError("Pesanan tidak ditemukan.", 404);
    }

    return res.status(200).json({
      success: true,
      message: "Detail pesanan berhasil diambil.",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllProductReviewsForAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page, limit, skip } = getPagination(req);
    const { productId, userId } = req.query;

    const where: Prisma.ProductReviewWhereInput = {};

    if (productId) {
      where.productId = getIdParam(productId, "Product ID");
    }

    if (userId) {
      where.userId = getIdParam(userId, "User ID");
    }

    const [reviews, total] = await prisma.$transaction([
      prisma.productReview.findMany({
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
      prisma.productReview.count({
        where,
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Data review produk berhasil diambil.",
      data: reviews,
      meta: createPaginationMeta(page, limit, total),
    });
  } catch (error) {
    next(error);
  }
};

export const deleteProductReviewForAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const reviewId = getIdParam(req.params.id, "Review ID");

    const review = await prisma.productReview.findUnique({
      where: {
        id: reviewId,
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

export const getAllApplicationReviewsForAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page, limit, skip } = getPagination(req);
    const { userId } = req.query;

    const where: Prisma.ApplicationReviewWhereInput = {};

    if (userId) {
      where.userId = getIdParam(userId, "User ID");
    }

    const [reviews, total] = await prisma.$transaction([
      prisma.applicationReview.findMany({
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
      prisma.applicationReview.count({
        where,
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Data review aplikasi berhasil diambil.",
      data: reviews,
      meta: createPaginationMeta(page, limit, total),
    });
  } catch (error) {
    next(error);
  }
};

export const deleteApplicationReviewForAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const reviewId = getIdParam(req.params.id, "Application Review ID");

    const review = await prisma.applicationReview.findUnique({
      where: {
        id: reviewId,
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
