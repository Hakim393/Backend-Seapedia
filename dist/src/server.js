"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const app_1 = __importDefault(require("./app"));
const prisma_1 = __importDefault(require("./config/prisma"));
const PORT = Number(process.env.PORT) || 5000;
const startServer = async () => {
    try {
        await prisma_1.default.$connect();
        console.log("Database connected successfully.");
        const server = app_1.default.listen(PORT, () => {
            console.log(`SEAPEDIA Backend API running on http://localhost:${PORT}`);
            console.log(`Swagger Docs available at http://localhost:${PORT}/api-docs`);
        });
        const shutdown = async (signal) => {
            console.log(`${signal} received. Shutting down server...`);
            server.close(async () => {
                try {
                    await prisma_1.default.$disconnect();
                    console.log("Database disconnected successfully.");
                    console.log("Server closed.");
                    process.exit(0);
                }
                catch (error) {
                    console.error("Error while disconnecting database:", error);
                    process.exit(1);
                }
            });
        };
        process.on("SIGINT", () => shutdown("SIGINT"));
        process.on("SIGTERM", () => shutdown("SIGTERM"));
    }
    catch (error) {
        console.error("Failed to start server:", error);
        await prisma_1.default.$disconnect();
        process.exit(1);
    }
};
startServer();
