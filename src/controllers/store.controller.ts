import type { NextFunction, Request, Response } from "express";
import { Prisma, ProductStatus, StoreStatus } from "@prisma/client";
import prisma from "../config/prisma";
import { AppError } from "../middleware/error.middleware";
import {
  sanitizeNullableText,
  sanitizeSearchQuery,
  sanitizeText,
} from "../utils/sanitize";

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

const slugify = (value: string) => {
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

const createUniqueStoreSlug = async (name: string, ignoreStoreId?: number) => {
  const baseSlug = slugify(name);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existingStore = await prisma.store.findFirst({
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

const normalizeProduct = (product: any) => {
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
      status: ProductStatus.ACTIVE,
    },
    take: 8,
    orderBy: {
      createdAt: "desc" as const,
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

export const getAllStores = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { page, limit, skip } = getPagination(req);
    const search = sanitizeSearchQuery(req.query.search);

    const where: Prisma.StoreWhereInput = {
      status: StoreStatus.ACTIVE,
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

    const [stores, total] = await prisma.$transaction([
      prisma.store.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
        include: storeListInclude,
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

export const getStoreById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const storeId = parseIdParam(req.params.id, "Store ID");

    const store = await prisma.store.findFirst({
      where: {
        id: storeId,
        status: StoreStatus.ACTIVE,
      },
      include: storeDetailInclude,
    });

    if (!store) {
      throw new AppError("Toko tidak ditemukan.", 404);
    }

    return res.status(200).json({
      success: true,
      message: "Detail toko berhasil diambil.",
      data: {
        ...store,
        products: store.products.map(normalizeProduct),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getStoreBySlug = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const slug = sanitizeText(req.params.slug, {
      maxLength: 180,
      trim: true,
      allowNewLines: false,
    });

    if (!slug) {
      throw new AppError("Slug toko tidak valid.", 400);
    }

    const store = await prisma.store.findFirst({
      where: {
        slug,
        status: StoreStatus.ACTIVE,
      },
      include: storeDetailInclude,
    });

    if (!store) {
      throw new AppError("Toko tidak ditemukan.", 404);
    }

    return res.status(200).json({
      success: true,
      message: "Detail toko berhasil diambil.",
      data: {
        ...store,
        products: store.products.map(normalizeProduct),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getStoreProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const storeId = parseIdParam(req.params.id, "Store ID");
    const { page, limit, skip } = getPagination(req);
    const search = sanitizeSearchQuery(req.query.search);
    const categoryId = req.query.categoryId;
    const sort = String(req.query.sort || "latest");

    const store = await prisma.store.findFirst({
      where: {
        id: storeId,
        status: StoreStatus.ACTIVE,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
      },
    });

    if (!store) {
      throw new AppError("Toko tidak ditemukan.", 404);
    }

    const where: Prisma.ProductWhereInput = {
      storeId,
      status: ProductStatus.ACTIVE,
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

    let orderBy: Prisma.ProductOrderByWithRelationInput = {
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

    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
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
      prisma.product.count({
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
  } catch (error) {
    next(error);
  }
};

export const getMyStore = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sellerId = getUserId(req);

    const store = await prisma.store.findUnique({
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
      throw new AppError("Kamu belum memiliki toko.", 404);
    }

    return res.status(200).json({
      success: true,
      message: "Data toko saya berhasil diambil.",
      data: {
        ...store,
        products: store.products.map(normalizeProduct),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createStore = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sellerId = getUserId(req);
    const { name, description, logoUrl, address } = req.body;

    const existingStore = await prisma.store.findUnique({
      where: {
        sellerId,
      },
      select: {
        id: true,
      },
    });

    if (existingStore) {
      throw new AppError("Kamu sudah memiliki toko.", 409);
    }

    const cleanName = sanitizeText(name, {
      maxLength: 150,
      trim: true,
      allowNewLines: false,
    });

    const cleanDescription = sanitizeNullableText(description, {
      maxLength: 2000,
      trim: true,
      allowNewLines: true,
    });

    const cleanLogoUrl = sanitizeNullableText(logoUrl, {
      maxLength: 1000,
      trim: true,
      allowNewLines: false,
    });

    const cleanAddress = sanitizeNullableText(address, {
      maxLength: 500,
      trim: true,
      allowNewLines: true,
    });

    if (!cleanName) {
      throw new AppError("Nama toko wajib diisi.", 400);
    }

    const slug = await createUniqueStoreSlug(cleanName);

    const store = await prisma.store.create({
      data: {
        name: cleanName,
        slug,
        description: cleanDescription,
        logoUrl: cleanLogoUrl,
        address: cleanAddress,
        status: StoreStatus.ACTIVE,
        sellerId,
      },
      include: storeListInclude,
    });

    return res.status(201).json({
      success: true,
      message: "Toko berhasil dibuat.",
      data: store,
    });
  } catch (error) {
    next(error);
  }
};

export const updateMyStore = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sellerId = getUserId(req);
    const { name, description, logoUrl, address } = req.body;

    const store = await prisma.store.findUnique({
      where: {
        sellerId,
      },
    });

    if (!store) {
      throw new AppError("Kamu belum memiliki toko.", 404);
    }

    const updateData: Prisma.StoreUpdateInput = {};

    if (name !== undefined) {
      const cleanName = sanitizeText(name, {
        maxLength: 150,
        trim: true,
        allowNewLines: false,
      });

      if (!cleanName) {
        throw new AppError("Nama toko tidak boleh kosong.", 400);
      }

      updateData.name = cleanName;
      updateData.slug = await createUniqueStoreSlug(cleanName, store.id);
    }

    if (description !== undefined) {
      updateData.description = sanitizeNullableText(description, {
        maxLength: 2000,
        trim: true,
        allowNewLines: true,
      });
    }

    if (logoUrl !== undefined) {
      updateData.logoUrl = sanitizeNullableText(logoUrl, {
        maxLength: 1000,
        trim: true,
        allowNewLines: false,
      });
    }

    if (address !== undefined) {
      updateData.address = sanitizeNullableText(address, {
        maxLength: 500,
        trim: true,
        allowNewLines: true,
      });
    }

    if (Object.keys(updateData).length === 0) {
      throw new AppError("Tidak ada data yang diperbarui.", 400);
    }

    const updatedStore = await prisma.store.update({
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
  } catch (error) {
    next(error);
  }
};

export const deactivateMyStore = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sellerId = getUserId(req);

    const store = await prisma.store.findUnique({
      where: {
        sellerId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!store) {
      throw new AppError("Kamu belum memiliki toko.", 404);
    }

    if (store.status === StoreStatus.INACTIVE) {
      return res.status(200).json({
        success: true,
        message: "Toko sudah dalam keadaan tidak aktif.",
      });
    }

    const updatedStore = await prisma.store.update({
      where: {
        id: store.id,
      },
      data: {
        status: StoreStatus.INACTIVE,
        products: {
          updateMany: {
            where: {
              status: ProductStatus.ACTIVE,
            },
            data: {
              status: ProductStatus.INACTIVE,
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
  } catch (error) {
    next(error);
  }
};

export const activateMyStore = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sellerId = getUserId(req);

    const store = await prisma.store.findUnique({
      where: {
        sellerId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!store) {
      throw new AppError("Kamu belum memiliki toko.", 404);
    }

    if (store.status === StoreStatus.SUSPENDED) {
      throw new AppError(
        "Toko kamu sedang disuspend oleh admin dan tidak bisa diaktifkan sendiri.",
        403
      );
    }

    if (store.status === StoreStatus.ACTIVE) {
      return res.status(200).json({
        success: true,
        message: "Toko sudah dalam keadaan aktif.",
      });
    }

    const updatedStore = await prisma.store.update({
      where: {
        id: store.id,
      },
      data: {
        status: StoreStatus.ACTIVE,
      },
      include: storeListInclude,
    });

    return res.status(200).json({
      success: true,
      message: "Toko berhasil diaktifkan.",
      data: updatedStore,
    });
  } catch (error) {
    next(error);
  }
};