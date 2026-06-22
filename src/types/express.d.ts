import type { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface AuthUser {
      id: number;
      name?: string;
      email: string;
      role: Role;
    }

    interface Request {
      user?: AuthUser;
    }
  }
}

export {};