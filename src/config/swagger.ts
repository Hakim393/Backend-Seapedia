import "dotenv/config";
import swaggerJSDoc from "swagger-jsdoc";
import type { Options } from "swagger-jsdoc";

const PORT = process.env.PORT || 5000;

const serverUrl =
  process.env.API_BASE_URL || `http://localhost:${PORT}`;

const swaggerOptions: Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "SEAPEDIA Backend API",
      version: "1.0.0",
      description:
        "Dokumentasi REST API untuk SEAPEDIA, marketplace multi-seller dengan fitur authentication, store, product, cart, checkout, order status, review, dan admin dashboard.",
      contact: {
        name: "SEAPEDIA Development Team",
      },
    },
    servers: [
      {
        url: serverUrl,
        description: "Development Server",
      },
    ],
    tags: [
      {
        name: "Auth",
        description: "Endpoint untuk register, login, dan autentikasi akun.",
      },
      {
        name: "Stores",
        description: "Endpoint untuk mengelola toko atau seller.",
      },
      {
        name: "Products",
        description: "Endpoint untuk melihat dan mengelola produk marketplace.",
      },
      {
        name: "Cart",
        description:
          "Endpoint keranjang belanja. Satu cart hanya boleh berisi produk dari satu toko.",
      },
      {
        name: "Orders",
        description:
          "Endpoint checkout, daftar pesanan, detail pesanan, dan update status pesanan.",
      },
      {
        name: "Reviews",
        description:
          "Endpoint review produk dan review aplikasi dengan input yang disanitasi.",
      },
      {
        name: "Admin",
        description: "Endpoint khusus admin untuk mengelola data sistem.",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description:
            "Masukkan JWT token dari endpoint login. Format: Bearer <token>",
        },
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: false,
            },
            message: {
              type: "string",
              example: "Terjadi kesalahan pada server.",
            },
          },
        },

        SuccessResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            message: {
              type: "string",
              example: "Request berhasil diproses.",
            },
          },
        },

        RegisterRequest: {
          type: "object",
          required: ["name", "email", "password"],
          properties: {
            name: {
              type: "string",
              example: "Fikhi Hakim",
            },
            email: {
              type: "string",
              format: "email",
              example: "fikhi@example.com",
            },
            password: {
              type: "string",
              minLength: 6,
              example: "password123",
            },
            role: {
              type: "string",
              enum: ["USER", "SELLER", "ADMIN"],
              example: "USER",
            },
            phone: {
              type: "string",
              nullable: true,
              example: "081234567890",
            },
            address: {
              type: "string",
              nullable: true,
              example: "Tangerang, Banten",
            },
          },
        },

        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: {
              type: "string",
              format: "email",
              example: "fikhi@example.com",
            },
            password: {
              type: "string",
              example: "password123",
            },
          },
        },

        AuthResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            message: {
              type: "string",
              example: "Login berhasil.",
            },
            data: {
              type: "object",
              properties: {
                token: {
                  type: "string",
                  example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                },
                user: {
                  $ref: "#/components/schemas/User",
                },
              },
            },
          },
        },

        User: {
          type: "object",
          properties: {
            id: {
              type: "integer",
              example: 1,
            },
            name: {
              type: "string",
              example: "Fikhi Hakim",
            },
            email: {
              type: "string",
              example: "fikhi@example.com",
            },
            role: {
              type: "string",
              enum: ["USER", "SELLER", "ADMIN"],
              example: "USER",
            },
            phone: {
              type: "string",
              nullable: true,
              example: "081234567890",
            },
            address: {
              type: "string",
              nullable: true,
              example: "Tangerang, Banten",
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
        },

        Store: {
          type: "object",
          properties: {
            id: {
              type: "integer",
              example: 1,
            },
            name: {
              type: "string",
              example: "Toko Gadget Nusantara",
            },
            slug: {
              type: "string",
              example: "toko-gadget-nusantara",
            },
            description: {
              type: "string",
              nullable: true,
              example: "Toko perlengkapan gadget terpercaya.",
            },
            logoUrl: {
              type: "string",
              nullable: true,
              example: "https://example.com/logo.png",
            },
            address: {
              type: "string",
              nullable: true,
              example: "Tangerang, Banten",
            },
            status: {
              type: "string",
              enum: ["ACTIVE", "INACTIVE", "SUSPENDED"],
              example: "ACTIVE",
            },
            sellerId: {
              type: "integer",
              example: 2,
            },
          },
        },

        CreateStoreRequest: {
          type: "object",
          required: ["name"],
          properties: {
            name: {
              type: "string",
              example: "Toko Gadget Nusantara",
            },
            description: {
              type: "string",
              example: "Toko perlengkapan gadget terpercaya.",
            },
            logoUrl: {
              type: "string",
              example: "https://example.com/logo.png",
            },
            address: {
              type: "string",
              example: "Tangerang, Banten",
            },
          },
        },

        Category: {
          type: "object",
          properties: {
            id: {
              type: "integer",
              example: 1,
            },
            name: {
              type: "string",
              example: "Elektronik",
            },
            slug: {
              type: "string",
              example: "elektronik",
            },
          },
        },

        Product: {
          type: "object",
          properties: {
            id: {
              type: "integer",
              example: 1,
            },
            name: {
              type: "string",
              example: "Keyboard Mechanical RGB",
            },
            slug: {
              type: "string",
              example: "keyboard-mechanical-rgb",
            },
            description: {
              type: "string",
              nullable: true,
              example: "Keyboard gaming dengan switch blue.",
            },
            price: {
              type: "number",
              example: 350000,
            },
            stock: {
              type: "integer",
              example: 20,
            },
            imageUrl: {
              type: "string",
              nullable: true,
              example: "https://example.com/product.jpg",
            },
            status: {
              type: "string",
              enum: ["ACTIVE", "INACTIVE", "OUT_OF_STOCK"],
              example: "ACTIVE",
            },
            storeId: {
              type: "integer",
              example: 1,
            },
            categoryId: {
              type: "integer",
              nullable: true,
              example: 1,
            },
          },
        },

        CreateProductRequest: {
          type: "object",
          required: ["name", "price", "stock"],
          properties: {
            name: {
              type: "string",
              example: "Keyboard Mechanical RGB",
            },
            description: {
              type: "string",
              example: "Keyboard gaming dengan switch blue.",
            },
            price: {
              type: "number",
              example: 350000,
            },
            stock: {
              type: "integer",
              example: 20,
            },
            imageUrl: {
              type: "string",
              example: "https://example.com/product.jpg",
            },
            categoryId: {
              type: "integer",
              nullable: true,
              example: 1,
            },
          },
        },

        UpdateProductRequest: {
          type: "object",
          properties: {
            name: {
              type: "string",
              example: "Keyboard Mechanical RGB Updated",
            },
            description: {
              type: "string",
              example: "Keyboard gaming premium.",
            },
            price: {
              type: "number",
              example: 400000,
            },
            stock: {
              type: "integer",
              example: 15,
            },
            imageUrl: {
              type: "string",
              example: "https://example.com/product-updated.jpg",
            },
            status: {
              type: "string",
              enum: ["ACTIVE", "INACTIVE", "OUT_OF_STOCK"],
              example: "ACTIVE",
            },
            categoryId: {
              type: "integer",
              nullable: true,
              example: 1,
            },
          },
        },

        Cart: {
          type: "object",
          properties: {
            id: {
              type: "integer",
              example: 1,
            },
            userId: {
              type: "integer",
              example: 1,
            },
            storeId: {
              type: "integer",
              nullable: true,
              example: 1,
            },
            items: {
              type: "array",
              items: {
                $ref: "#/components/schemas/CartItem",
              },
            },
          },
        },

        CartItem: {
          type: "object",
          properties: {
            id: {
              type: "integer",
              example: 1,
            },
            cartId: {
              type: "integer",
              example: 1,
            },
            productId: {
              type: "integer",
              example: 1,
            },
            quantity: {
              type: "integer",
              example: 2,
            },
          },
        },

        AddCartItemRequest: {
          type: "object",
          required: ["productId", "quantity"],
          properties: {
            productId: {
              type: "integer",
              example: 1,
            },
            quantity: {
              type: "integer",
              minimum: 1,
              example: 2,
            },
          },
        },

        UpdateCartItemRequest: {
          type: "object",
          required: ["quantity"],
          properties: {
            quantity: {
              type: "integer",
              minimum: 1,
              example: 3,
            },
          },
        },

        CheckoutRequest: {
          type: "object",
          required: ["shippingAddress"],
          properties: {
            shippingAddress: {
              type: "string",
              example: "Jl. Raya Tangerang, Banten",
            },
            paymentMethod: {
              type: "string",
              example: "COD",
            },
            notes: {
              type: "string",
              example: "Tolong dikirim sore hari.",
            },
          },
        },

        Order: {
          type: "object",
          properties: {
            id: {
              type: "integer",
              example: 1,
            },
            orderNumber: {
              type: "string",
              example: "SEA-20260622-0001",
            },
            status: {
              type: "string",
              enum: [
                "SEDANG_DIKEMAS",
                "MENUNGGU_PENGIRIM",
                "SEDANG_DIKIRIM",
                "PESANAN_SELESAI",
                "DIKEMBALIKAN",
              ],
              example: "SEDANG_DIKEMAS",
            },
            paymentStatus: {
              type: "string",
              enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
              example: "PENDING",
            },
            paymentMethod: {
              type: "string",
              nullable: true,
              example: "COD",
            },
            totalAmount: {
              type: "number",
              example: 700000,
            },
            shippingAddress: {
              type: "string",
              example: "Jl. Raya Tangerang, Banten",
            },
            courierName: {
              type: "string",
              nullable: true,
              example: "JNE",
            },
            trackingNumber: {
              type: "string",
              nullable: true,
              example: "JNE123456789",
            },
            notes: {
              type: "string",
              nullable: true,
              example: "Tolong dikirim sore hari.",
            },
            userId: {
              type: "integer",
              example: 1,
            },
            storeId: {
              type: "integer",
              example: 1,
            },
          },
        },

        UpdateOrderStatusRequest: {
          type: "object",
          required: ["status"],
          properties: {
            status: {
              type: "string",
              enum: [
                "SEDANG_DIKEMAS",
                "MENUNGGU_PENGIRIM",
                "SEDANG_DIKIRIM",
                "PESANAN_SELESAI",
                "DIKEMBALIKAN",
              ],
              example: "SEDANG_DIKIRIM",
            },
            courierName: {
              type: "string",
              example: "JNE",
            },
            trackingNumber: {
              type: "string",
              example: "JNE123456789",
            },
            note: {
              type: "string",
              example: "Pesanan sudah diserahkan ke kurir.",
            },
          },
        },

        UpdatePaymentStatusRequest: {
          type: "object",
          required: ["paymentStatus"],
          properties: {
            paymentStatus: {
              type: "string",
              enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
              example: "PAID",
            },
          },
        },

        ProductReview: {
          type: "object",
          properties: {
            id: {
              type: "integer",
              example: 1,
            },
            rating: {
              type: "integer",
              example: 5,
            },
            comment: {
              type: "string",
              nullable: true,
              example: "Produknya bagus dan pengiriman cepat.",
            },
            userId: {
              type: "integer",
              example: 1,
            },
            productId: {
              type: "integer",
              example: 1,
            },
          },
        },

        CreateProductReviewRequest: {
          type: "object",
          required: ["rating"],
          properties: {
            rating: {
              type: "integer",
              minimum: 1,
              maximum: 5,
              example: 5,
            },
            comment: {
              type: "string",
              example: "Produknya bagus dan pengiriman cepat.",
            },
          },
        },

        ApplicationReview: {
          type: "object",
          properties: {
            id: {
              type: "integer",
              example: 1,
            },
            rating: {
              type: "integer",
              example: 5,
            },
            comment: {
              type: "string",
              nullable: true,
              example: "Aplikasi SEAPEDIA mudah digunakan.",
            },
            userId: {
              type: "integer",
              example: 1,
            },
          },
        },

        CreateApplicationReviewRequest: {
          type: "object",
          required: ["rating"],
          properties: {
            rating: {
              type: "integer",
              minimum: 1,
              maximum: 5,
              example: 5,
            },
            comment: {
              type: "string",
              example: "Aplikasi SEAPEDIA mudah digunakan.",
            },
          },
        },
      },
    },
  },
  apis: [
    "./src/routes/*.ts",
    "./src/controllers/*.ts",
    "./dist/routes/*.js",
    "./dist/controllers/*.js",
  ],
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

export default swaggerSpec;