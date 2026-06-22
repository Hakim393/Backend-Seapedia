import type { NextFunction, Request, Response } from "express";
import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  ProductStatus,
  StoreStatus,
} from "@prisma/client";
import prisma from "../config/prisma";
import { AppError } from "../middleware/error.middleware";
import { sanitizeNullableText, sanitizeText } from "../utils/sanitize";

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

const isValidEnumValue = <T extends Record<string, string>>(
  enumObject: T,
  value: unknown
): value is T[keyof T] => {
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
      createdAt: "desc" as const,
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

const normalizeOrder = (order: any) => {
  return {
    ...order,
    totalAmount: Number(order.totalAmount),
    items: order.items?.map((item: any) => ({
      ...item,
      price: Number(item.price),
      subtotal: Number(item.subtotal),
    })),
  };
};

const validateOrderStatusTransition = (
  currentStatus: OrderStatus,
  newStatus: OrderStatus
) => {
  if (currentStatus === newStatus) {
    return;
  }

  const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.SEDANG_DIKEMAS]: [
      OrderStatus.MENUNGGU_PENGIRIM,
      OrderStatus.DIKEMBALIKAN,
    ],
    [OrderStatus.MENUNGGU_PENGIRIM]: [
      OrderStatus.SEDANG_DIKIRIM,
      OrderStatus.DIKEMBALIKAN,
    ],
    [OrderStatus.SEDANG_DIKIRIM]: [
      OrderStatus.PESANAN_SELESAI,
      OrderStatus.DIKEMBALIKAN,
    ],
    [OrderStatus.PESANAN_SELESAI]: [OrderStatus.DIKEMBALIKAN],
    [OrderStatus.DIKEMBALIKAN]: [],
  };

  if (!allowedTransitions[currentStatus].includes(newStatus)) {
    throw new AppError(
      `Status pesanan tidak bisa diubah dari ${currentStatus} ke ${newStatus}.`,
      400
    );
  }
};

const getSellerStore = async (sellerId: number) => {
  const store = await prisma.store.findUnique({
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
    throw new AppError("Seller belum memiliki toko.", 404);
  }

  return store;
};

export const checkout = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getUserId(req);
    const { shippingAddress, paymentMethod, notes } = req.body;

    const cleanShippingAddress = sanitizeText(shippingAddress, {
      maxLength: 500,
      trim: true,
      allowNewLines: true,
    });

    const cleanPaymentMethod = sanitizeNullableText(paymentMethod || "COD", {
      maxLength: 50,
      trim: true,
      allowNewLines: false,
    });

    const cleanNotes = sanitizeNullableText(notes, {
      maxLength: 500,
      trim: true,
      allowNewLines: true,
    });

    if (!cleanShippingAddress) {
      throw new AppError("Alamat pengiriman wajib diisi.", 400);
    }

    const createdOrder = await prisma.$transaction(async (tx) => {
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
        throw new AppError("Cart masih kosong.", 400);
      }

      if (!cart.storeId) {
        throw new AppError("Cart tidak memiliki informasi toko.", 400);
      }

      if (!cart.store) {
        throw new AppError("Toko tidak ditemukan.", 404);
      }

      if (cart.store.status !== StoreStatus.ACTIVE) {
        throw new AppError("Toko sedang tidak aktif.", 400);
      }

      const hasDifferentStore = cart.items.some(
        (item) => item.product.storeId !== cart.storeId
      );

      if (hasDifferentStore) {
        throw new AppError(
          "Cart tidak valid. Satu cart hanya boleh berisi produk dari satu toko.",
          400
        );
      }

      let totalAmount = 0;

      for (const item of cart.items) {
        if (item.product.status !== ProductStatus.ACTIVE) {
          throw new AppError(
            `Produk ${item.product.name} sedang tidak aktif.`,
            400
          );
        }

        if (item.product.store.status !== StoreStatus.ACTIVE) {
          throw new AppError(
            `Toko dari produk ${item.product.name} sedang tidak aktif.`,
            400
          );
        }

        if (item.product.stock < item.quantity) {
          throw new AppError(
            `Stok produk ${item.product.name} tidak mencukupi. Stok tersedia hanya ${item.product.stock}.`,
            400
          );
        }

        totalAmount += Number(item.product.price) * item.quantity;
      }

      const order = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          userId,
          storeId: cart.storeId,
          status: OrderStatus.SEDANG_DIKEMAS,
          paymentStatus: PaymentStatus.PENDING,
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
              newStatus: OrderStatus.SEDANG_DIKEMAS,
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
              status: ProductStatus.OUT_OF_STOCK,
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
  } catch (error) {
    next(error);
  }
};

export const getMyOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getUserId(req);
    const { page, limit, skip } = getPagination(req);
    const { status, paymentStatus } = req.query;

    const where: Prisma.OrderWhereInput = {
      userId,
    };

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

    const [orders, total] = await prisma.$transaction([
      prisma.order.findMany({
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
      prisma.order.count({
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
  } catch (error) {
    next(error);
  }
};

export const getMyOrderDetail = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getUserId(req);
    const orderId = parseIdParam(req.params.id, "Order ID");

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
      include: orderInclude,
    });

    if (!order) {
      throw new AppError("Pesanan tidak ditemukan.", 404);
    }

    return res.status(200).json({
      success: true,
      message: "Detail pesanan berhasil diambil.",
      data: normalizeOrder(order),
    });
  } catch (error) {
    next(error);
  }
};

export const getSellerOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sellerId = getUserId(req);
    const { page, limit, skip } = getPagination(req);
    const { status, paymentStatus } = req.query;

    const store = await getSellerStore(sellerId);

    const where: Prisma.OrderWhereInput = {
      storeId: store.id,
    };

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
      prisma.order.count({
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
  } catch (error) {
    next(error);
  }
};

export const getSellerOrderDetail = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sellerId = getUserId(req);
    const orderId = parseIdParam(req.params.id, "Order ID");

    const store = await getSellerStore(sellerId);

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        storeId: store.id,
      },
      include: orderInclude,
    });

    if (!order) {
      throw new AppError("Pesanan tidak ditemukan.", 404);
    }

    return res.status(200).json({
      success: true,
      message: "Detail pesanan toko berhasil diambil.",
      data: normalizeOrder(order),
    });
  } catch (error) {
    next(error);
  }
};

export const updateOrderStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sellerId = getUserId(req);
    const orderId = parseIdParam(req.params.id, "Order ID");
    const { status, courierName, trackingNumber, note } = req.body;

    if (!isValidEnumValue(OrderStatus, status)) {
      throw new AppError("Status pesanan tidak valid.", 400);
    }

    const order = await prisma.order.findUnique({
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
      throw new AppError("Pesanan tidak ditemukan.", 404);
    }

    if (order.store.sellerId !== sellerId) {
      throw new AppError(
        "Kamu tidak memiliki akses untuk mengubah pesanan toko ini.",
        403
      );
    }

    validateOrderStatusTransition(order.status, status);

    const cleanCourierName = sanitizeNullableText(courierName, {
      maxLength: 100,
      trim: true,
      allowNewLines: false,
    });

    const cleanTrackingNumber = sanitizeNullableText(trackingNumber, {
      maxLength: 100,
      trim: true,
      allowNewLines: false,
    });

    const cleanNote = sanitizeNullableText(note, {
      maxLength: 500,
      trim: true,
      allowNewLines: true,
    });

    const updatedOrder = await prisma.order.update({
      where: {
        id: orderId,
      },
      data: {
        status,
        courierName:
          cleanCourierName !== null ? cleanCourierName : order.courierName,
        trackingNumber:
          cleanTrackingNumber !== null
            ? cleanTrackingNumber
            : order.trackingNumber,
        completedAt:
          status === OrderStatus.PESANAN_SELESAI
            ? new Date()
            : order.completedAt,
        returnedAt:
          status === OrderStatus.DIKEMBALIKAN ? new Date() : order.returnedAt,
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
  } catch (error) {
    next(error);
  }
};

export const updatePaymentStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sellerId = getUserId(req);
    const orderId = parseIdParam(req.params.id, "Order ID");
    const { paymentStatus } = req.body;

    if (!isValidEnumValue(PaymentStatus, paymentStatus)) {
      throw new AppError("Status pembayaran tidak valid.", 400);
    }

    const order = await prisma.order.findUnique({
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
      throw new AppError("Pesanan tidak ditemukan.", 404);
    }

    if (order.store.sellerId !== sellerId) {
      throw new AppError(
        "Kamu tidak memiliki akses untuk mengubah pembayaran pesanan toko ini.",
        403
      );
    }

    let paidAt: Date | null = order.paidAt;

    if (paymentStatus === PaymentStatus.PAID) {
      paidAt = order.paidAt ?? new Date();
    }

    if (
      paymentStatus === PaymentStatus.PENDING ||
      paymentStatus === PaymentStatus.FAILED
    ) {
      paidAt = null;
    }

    const updatedOrder = await prisma.order.update({
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
  } catch (error) {
    next(error);
  }
};

export const markMyOrderAsCompleted = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getUserId(req);
    const orderId = parseIdParam(req.params.id, "Order ID");

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
    });

    if (!order) {
      throw new AppError("Pesanan tidak ditemukan.", 404);
    }

    if (order.status !== OrderStatus.SEDANG_DIKIRIM) {
      throw new AppError(
        "Pesanan hanya bisa diselesaikan saat status Sedang Dikirim.",
        400
      );
    }

    const updatedOrder = await prisma.order.update({
      where: {
        id: orderId,
      },
      data: {
        status: OrderStatus.PESANAN_SELESAI,
        completedAt: new Date(),
        statusHistories: {
          create: {
            oldStatus: order.status,
            newStatus: OrderStatus.PESANAN_SELESAI,
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
  } catch (error) {
    next(error);
  }
};

export const requestReturnOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getUserId(req);
    const orderId = parseIdParam(req.params.id, "Order ID");
    const { reason } = req.body;

    const cleanReason = sanitizeNullableText(reason, {
      maxLength: 500,
      trim: true,
      allowNewLines: true,
    });

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
    });

    if (!order) {
      throw new AppError("Pesanan tidak ditemukan.", 404);
    }

    if (
      order.status !== OrderStatus.SEDANG_DIKIRIM &&
      order.status !== OrderStatus.PESANAN_SELESAI
    ) {
      throw new AppError(
        "Pesanan hanya bisa dikembalikan saat status Sedang Dikirim atau Pesanan Selesai.",
        400
      );
    }

    const updatedOrder = await prisma.order.update({
      where: {
        id: orderId,
      },
      data: {
        status: OrderStatus.DIKEMBALIKAN,
        returnedAt: new Date(),
        statusHistories: {
          create: {
            oldStatus: order.status,
            newStatus: OrderStatus.DIKEMBALIKAN,
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
  } catch (error) {
    next(error);
  }
};