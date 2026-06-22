import type { NextFunction, Request, Response } from "express";
import { Prisma, ProductStatus, StoreStatus } from "@prisma/client";
import prisma from "../config/prisma";
import { AppError } from "../middleware/error.middleware";
import {
  sanitizeNullableText,
  sanitizeSearchQuery,
  sanitizeText,
  sanitizeUrl,
} from "../utils/sanitize";

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

const parsePrice = (value: unknown, fieldName = "Harga") => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new AppError(`${fieldName} harus berupa angka minimal 0.`, 400);
  }

  return parsed;
};

const parseStock = (value: unknown) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new AppError("Stok harus berupa angka minimal 0.", 400);
  }

  return parsed;
};

const isValidEnumValue = <T extends Record<string, string>>(
  enumObject: T,
  value: unknown
): value is T[keyof T] => {
  return typeof value === "string" && Object.values(enumObject).includes(value);
};

const getUserId = (req: Request) => {
  if (!req.user) {
    throw new AppError("Silakan login terlebih dahulu.", 401);
  }

  return req.user.id;
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

  return slug || "item";
};

const createUniqueProductSlug = async (
  storeId: number,
  name: string,
  ignoreProductId?: number
) => {
  const baseSlug = slugify(name);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existingProduct = await prisma.product.findFirst({
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

const createUniqueCategorySlug = async (
  name: string,
  ignoreCategoryId?: number
) => {
  const baseSlug = slugify(name);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existingCategory = await prisma.category.findFirst({
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

  if (store.status !== StoreStatus.ACTIVE) {
    throw new AppError("Toko kamu sedang tidak aktif.", 400);
  }

  return store;
};

const normalizeProduct = (product: any) => {
  const reviews = product.productReviews || [];

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((total: number, review: any) => total + review.rating, 0) /
        reviews.length
      : null;

  return {
    ...product,
    price: Number(product.price),
    averageRating:
      averageRating === null ? null : Number(averageRating.toFixed(1)),
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
      createdAt: "desc" as const,
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

export const getAllProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { page, limit, skip } = getPagination(req);

    const search = sanitizeSearchQuery(req.query.search);
    const categoryId = req.query.categoryId;
    const categorySlug = req.query.categorySlug;
    const storeId = req.query.storeId;
    const storeSlug = req.query.storeSlug;
    const minPrice = req.query.minPrice;
    const maxPrice = req.query.maxPrice;
    const sort = String(req.query.sort || "latest");

    const where: Prisma.ProductWhereInput = {
      status: ProductStatus.ACTIVE,
      store: {
        status: StoreStatus.ACTIVE,
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
      const cleanCategorySlug = sanitizeText(categorySlug, {
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
      const cleanStoreSlug = sanitizeText(storeSlug, {
        maxLength: 180,
        trim: true,
        allowNewLines: false,
      });

      where.store = {
        status: StoreStatus.ACTIVE,
        slug: cleanStoreSlug,
      };
    }

    if (minPrice || maxPrice) {
      const priceFilter: Prisma.DecimalFilter = {};

      if (minPrice) {
        priceFilter.gte = parsePrice(minPrice, "Minimal harga");
      }

      if (maxPrice) {
        priceFilter.lte = parsePrice(maxPrice, "Maksimal harga");
      }

      where.price = priceFilter;
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
        include: productListInclude,
      }),
      prisma.product.count({
        where,
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Data produk berhasil diambil.",
      data: products.map(normalizeProduct),
      meta: createPaginationMeta(page, limit, total),
    });
  } catch (error) {
    next(error);
  }
};

export const getProductById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const productId = parseIdParam(req.params.id, "Product ID");

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        status: ProductStatus.ACTIVE,
        store: {
          status: StoreStatus.ACTIVE,
        },
      },
      include: productDetailInclude,
    });

    if (!product) {
      throw new AppError("Produk tidak ditemukan.", 404);
    }

    return res.status(200).json({
      success: true,
      message: "Detail produk berhasil diambil.",
      data: normalizeProduct(product),
    });
  } catch (error) {
    next(error);
  }
};

export const getProductBySlug = async (
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
      throw new AppError("Slug produk tidak valid.", 400);
    }

    const product = await prisma.product.findFirst({
      where: {
        slug,
        status: ProductStatus.ACTIVE,
        store: {
          status: StoreStatus.ACTIVE,
        },
      },
      include: productDetailInclude,
    });

    if (!product) {
      throw new AppError("Produk tidak ditemukan.", 404);
    }

    return res.status(200).json({
      success: true,
      message: "Detail produk berhasil diambil.",
      data: normalizeProduct(product),
    });
  } catch (error) {
    next(error);
  }
};

export const getSellerProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sellerId = getUserId(req);
    const store = await getSellerStore(sellerId);

    const { page, limit, skip } = getPagination(req);
    const search = sanitizeSearchQuery(req.query.search);
    const { status, categoryId } = req.query;

    const where: Prisma.ProductWhereInput = {
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
      if (!isValidEnumValue(ProductStatus, status)) {
        throw new AppError("Status produk tidak valid.", 400);
      }

      where.status = status;
    }

    if (categoryId) {
      where.categoryId = parseIdParam(categoryId, "Category ID");
    }

    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
        include: productListInclude,
      }),
      prisma.product.count({
        where,
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Data produk seller berhasil diambil.",
      data: products.map(normalizeProduct),
      meta: createPaginationMeta(page, limit, total),
    });
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sellerId = getUserId(req);
    const store = await getSellerStore(sellerId);

    const {
      name,
      description,
      price,
      stock,
      imageUrl,
      categoryId,
      status,
    } = req.body;

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

    const cleanImageUrl = sanitizeUrl(imageUrl, {
      maxLength: 1000,
    });

    if (!cleanName) {
      throw new AppError("Nama produk wajib diisi.", 400);
    }

    const cleanPrice = parsePrice(price);
    const cleanStock = parseStock(stock);

    if (cleanPrice <= 0) {
      throw new AppError("Harga produk harus lebih dari 0.", 400);
    }

    let cleanCategoryId: number | null = null;

    if (categoryId !== undefined && categoryId !== null && categoryId !== "") {
      cleanCategoryId = parseIdParam(categoryId, "Category ID");

      const category = await prisma.category.findUnique({
        where: {
          id: cleanCategoryId,
        },
        select: {
          id: true,
        },
      });

      if (!category) {
        throw new AppError("Kategori tidak ditemukan.", 404);
      }
    }

    let productStatus: ProductStatus =
      cleanStock === 0 ? ProductStatus.OUT_OF_STOCK : ProductStatus.ACTIVE;

    if (status) {
      if (!isValidEnumValue(ProductStatus, status)) {
        throw new AppError("Status produk tidak valid.", 400);
      }

      productStatus = status;

      if (cleanStock === 0 && productStatus === ProductStatus.ACTIVE) {
        productStatus = ProductStatus.OUT_OF_STOCK;
      }
    }

    const slug = await createUniqueProductSlug(store.id, cleanName);

    const product = await prisma.product.create({
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
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sellerId = getUserId(req);
    const store = await getSellerStore(sellerId);
    const productId = parseIdParam(req.params.id, "Product ID");

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        storeId: store.id,
      },
    });

    if (!product) {
      throw new AppError("Produk tidak ditemukan atau bukan milik toko kamu.", 404);
    }

    const {
      name,
      description,
      price,
      stock,
      imageUrl,
      categoryId,
      status,
    } = req.body;

    const updateData: Prisma.ProductUncheckedUpdateInput = {};

    if (name !== undefined) {
      const cleanName = sanitizeText(name, {
        maxLength: 150,
        trim: true,
        allowNewLines: false,
      });

      if (!cleanName) {
        throw new AppError("Nama produk tidak boleh kosong.", 400);
      }

      updateData.name = cleanName;
      updateData.slug = await createUniqueProductSlug(
        store.id,
        cleanName,
        product.id
      );
    }

    if (description !== undefined) {
      updateData.description = sanitizeNullableText(description, {
        maxLength: 2000,
        trim: true,
        allowNewLines: true,
      });
    }

    if (price !== undefined) {
      const cleanPrice = parsePrice(price);

      if (cleanPrice <= 0) {
        throw new AppError("Harga produk harus lebih dari 0.", 400);
      }

      updateData.price = cleanPrice;
    }

    if (stock !== undefined) {
      const cleanStock = parseStock(stock);

      updateData.stock = cleanStock;

      if (cleanStock === 0) {
        updateData.status = ProductStatus.OUT_OF_STOCK;
      }

      if (cleanStock > 0 && product.status === ProductStatus.OUT_OF_STOCK) {
        updateData.status = ProductStatus.ACTIVE;
      }
    }

    if (imageUrl !== undefined) {
      updateData.imageUrl = sanitizeUrl(imageUrl, {
        maxLength: 1000,
      });
    }

    if (categoryId !== undefined) {
      if (categoryId === null || categoryId === "") {
        updateData.categoryId = null;
      } else {
        const cleanCategoryId = parseIdParam(categoryId, "Category ID");

        const category = await prisma.category.findUnique({
          where: {
            id: cleanCategoryId,
          },
          select: {
            id: true,
          },
        });

        if (!category) {
          throw new AppError("Kategori tidak ditemukan.", 404);
        }

        updateData.categoryId = cleanCategoryId;
      }
    }

    if (status !== undefined) {
      if (!isValidEnumValue(ProductStatus, status)) {
        throw new AppError("Status produk tidak valid.", 400);
      }

      updateData.status = status;

      const finalStock =
        typeof updateData.stock === "number" ? updateData.stock : product.stock;

      if (finalStock === 0 && status === ProductStatus.ACTIVE) {
        updateData.status = ProductStatus.OUT_OF_STOCK;
      }
    }

    const updatedProduct = await prisma.product.update({
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
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sellerId = getUserId(req);
    const store = await getSellerStore(sellerId);
    const productId = parseIdParam(req.params.id, "Product ID");

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        storeId: store.id,
      },
      select: {
        id: true,
      },
    });

    if (!product) {
      throw new AppError("Produk tidak ditemukan atau bukan milik toko kamu.", 404);
    }

    await prisma.product.delete({
      where: {
        id: productId,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Produk berhasil dihapus.",
    });
  } catch (error) {
    next(error);
  }
};

export const getCategories = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const categories = await prisma.category.findMany({
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
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const cleanName = sanitizeText(req.body.name, {
      maxLength: 100,
      trim: true,
      allowNewLines: false,
    });

    if (!cleanName) {
      throw new AppError("Nama kategori wajib diisi.", 400);
    }

    const existingCategory = await prisma.category.findUnique({
      where: {
        name: cleanName,
      },
      select: {
        id: true,
      },
    });

    if (existingCategory) {
      throw new AppError("Nama kategori sudah digunakan.", 409);
    }

    const slug = await createUniqueCategorySlug(cleanName);

    const category = await prisma.category.create({
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
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const categoryId = parseIdParam(req.params.id, "Category ID");

    const cleanName = sanitizeText(req.body.name, {
      maxLength: 100,
      trim: true,
      allowNewLines: false,
    });

    if (!cleanName) {
      throw new AppError("Nama kategori wajib diisi.", 400);
    }

    const category = await prisma.category.findUnique({
      where: {
        id: categoryId,
      },
      select: {
        id: true,
      },
    });

    if (!category) {
      throw new AppError("Kategori tidak ditemukan.", 404);
    }

    const existingCategory = await prisma.category.findFirst({
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
      throw new AppError("Nama kategori sudah digunakan.", 409);
    }

    const slug = await createUniqueCategorySlug(cleanName, categoryId);

    const updatedCategory = await prisma.category.update({
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
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const categoryId = parseIdParam(req.params.id, "Category ID");

    const category = await prisma.category.findUnique({
      where: {
        id: categoryId,
      },
      select: {
        id: true,
      },
    });

    if (!category) {
      throw new AppError("Kategori tidak ditemukan.", 404);
    }

    await prisma.category.delete({
      where: {
        id: categoryId,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Kategori berhasil dihapus.",
    });
  } catch (error) {
    next(error);
  }
};