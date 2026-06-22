import "dotenv/config";
import app from "./app";
import prisma from "./config/prisma";

const PORT = Number(process.env.PORT) || 5000;

const startServer = async () => {
  try {
    await prisma.$connect();

    console.log("Database connected successfully.");

    const server = app.listen(PORT, () => {
      console.log(`SEAPEDIA Backend API running on http://localhost:${PORT}`);
      console.log(`Swagger Docs available at http://localhost:${PORT}/api-docs`);
    });

    const shutdown = async (signal: string) => {
      console.log(`${signal} received. Shutting down server...`);

      server.close(async () => {
        try {
          await prisma.$disconnect();
          console.log("Database disconnected successfully.");
          console.log("Server closed.");
          process.exit(0);
        } catch (error) {
          console.error("Error while disconnecting database:", error);
          process.exit(1);
        }
      });
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    console.error("Failed to start server:", error);

    await prisma.$disconnect();

    process.exit(1);
  }
};

startServer();