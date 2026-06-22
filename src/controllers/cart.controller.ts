import type { NextFunction, Request, Response } from "express";
import { ProductStatus, StoreStatus } from "@prisma/client";
import prisma from "../config/prisma";
import { AppError } from "../middleware/error.middleware";

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

const parseQuantity = (value: unknown) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new AppError("Quantity harus berupa angka minimal 1.", 400);
  }

  return parsed;
};

const formatCart = (cart: any) => {
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

  const items = cart.items.map((item: any) => {
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

  const totalQuantity = items.reduce(
    (total: number, item: any) => total + item.quantity,
    0
  );

  const totalAmount = items.reduce(
    (total: number, item: any) => total + item.subtotal,
    0
  );

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

const getCartWithItems = async (userId: number) => {
  return prisma.cart.findUnique({
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

export const getCart = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getUserId(req);

    const cart = await getCartWithItems(userId);

    return res.status(200).json({
      success: true,
      message: "Data cart berhasil diambil.",
      data: formatCart(cart),
    });
  } catch (error) {
    next(error);
  }
};

export const addCartItem = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getUserId(req);
    const productId = parseIdParam(req.body.productId, "Product ID");
    const quantity = parseQuantity(req.body.quantity);

    const product = await prisma.product.findUnique({
      where: {
        id: productId,
      },
      include: {
        store: true,
      },
    });

    if (!product) {
      throw new AppError("Produk tidak ditemukan.", 404);
    }

    if (product.status !== ProductStatus.ACTIVE) {
      throw new AppError("Produk sedang tidak aktif.", 400);
    }

    if (product.store.status !== StoreStatus.ACTIVE) {
      throw new AppError("Toko dari produk ini sedang tidak aktif.", 400);
    }

    if (product.stock < quantity) {
      throw new AppError("Stok produk tidak mencukupi.", 400);
    }

    let cart = await prisma.cart.findUnique({
      where: {
        userId,
      },
      include: {
        items: true,
      },
    });

    if (!cart) {
      cart = await prisma.cart.create({
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
      throw new AppError(
        "Keranjang kamu berisi produk dari toko lain. Kosongkan keranjang terlebih dahulu untuk membeli produk dari toko ini.",
        400
      );
    }

    if (!cart.storeId) {
      cart = await prisma.cart.update({
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
      throw new AppError(
        `Stok produk tidak mencukupi. Stok tersedia hanya ${product.stock}.`,
        400
      );
    }

    if (existingItem) {
      await prisma.cartItem.update({
        where: {
          id: existingItem.id,
        },
        data: {
          quantity: newQuantity,
        },
      });
    } else {
      await prisma.cartItem.create({
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
  } catch (error) {
    next(error);
  }
};

export const updateCartItemQuantity = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getUserId(req);
    const cartItemId = parseIdParam(req.params.itemId, "Cart Item ID");
    const quantity = parseQuantity(req.body.quantity);

    const cart = await prisma.cart.findUnique({
      where: {
        userId,
      },
    });

    if (!cart) {
      throw new AppError("Cart tidak ditemukan.", 404);
    }

    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id: cartItemId,
        cartId: cart.id,
      },
      include: {
        product: true,
      },
    });

    if (!cartItem) {
      throw new AppError("Item cart tidak ditemukan.", 404);
    }

    if (cartItem.product.status !== ProductStatus.ACTIVE) {
      throw new AppError("Produk sedang tidak aktif.", 400);
    }

    if (cartItem.product.stock < quantity) {
      throw new AppError(
        `Stok produk tidak mencukupi. Stok tersedia hanya ${cartItem.product.stock}.`,
        400
      );
    }

    await prisma.cartItem.update({
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
  } catch (error) {
    next(error);
  }
};

export const removeCartItem = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getUserId(req);
    const cartItemId = parseIdParam(req.params.itemId, "Cart Item ID");

    const cart = await prisma.cart.findUnique({
      where: {
        userId,
      },
      include: {
        items: true,
      },
    });

    if (!cart) {
      throw new AppError("Cart tidak ditemukan.", 404);
    }

    const cartItem = cart.items.find((item) => item.id === cartItemId);

    if (!cartItem) {
      throw new AppError("Item cart tidak ditemukan.", 404);
    }

    await prisma.cartItem.delete({
      where: {
        id: cartItemId,
      },
    });

    const remainingItems = await prisma.cartItem.count({
      where: {
        cartId: cart.id,
      },
    });

    if (remainingItems === 0) {
      await prisma.cart.update({
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
  } catch (error) {
    next(error);
  }
};

export const clearCart = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getUserId(req);

    const cart = await prisma.cart.findUnique({
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

    await prisma.$transaction([
      prisma.cartItem.deleteMany({
        where: {
          cartId: cart.id,
        },
      }),
      prisma.cart.update({
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
  } catch (error) {
    next(error);
  }
};