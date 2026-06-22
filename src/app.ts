import "dotenv/config";

import express from "express";
import cors, { type CorsOptions } from "cors";
import swaggerUi from "swagger-ui-express";

import routes from "./routes";
import swaggerSpec from "./config/swagger";
import {
  errorMiddleware,
  notFoundMiddleware,
} from "./middleware/error.middleware";

const app = express();

const isProduction = process.env.NODE_ENV === "production";

const defaultAllowedOrigins = [
  "http://localhost:5000", // Swagger UI backend
  "http://localhost:5173", // Vite default
  "http://localhost:5174", // Vite kalau 5173 kepakai
  "http://localhost:5175",
  "http://localhost:3000", // React / Next optional
  "http://127.0.0.1:5000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
  "http://127.0.0.1:3000",
];

const envAllowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  : [];

const clientOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  : [];

const allowedOrigins = [
  ...new Set([
    ...defaultAllowedOrigins,
    ...envAllowedOrigins,
    ...clientOrigins,
  ]),
];

const isLocalDevelopmentOrigin = (origin: string) => {
  return (
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:")
  );
};

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    /**
     * Request dari Postman, curl, Swagger internal, atau server-to-server
     * biasanya tidak punya origin. Ini aman untuk diizinkan.
     */
    if (!origin) {
      return callback(null, true);
    }

    /**
     * Saat development, izinkan semua localhost/127.0.0.1
     * supaya Vite yang port-nya berubah tetap bisa akses backend.
     */
    if (!isProduction && isLocalDevelopmentOrigin(origin)) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log("Blocked CORS origin:", origin);
    console.log("Allowed origins:", allowedOrigins);

    return callback(new Error("Origin tidak diizinkan oleh CORS."));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/api-docs.json", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  return res.status(200).send(swaggerSpec);
});

app.get("/", (_req, res) => {
  return res.status(200).json({
    success: true,
    message: "SEAPEDIA Backend API is running.",
    docs: "/api-docs",
    api: "/api",
  });
});

app.use("/api", routes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;