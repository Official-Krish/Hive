import type { AuthContext } from "../core/context";

declare global {
  namespace Express {
    interface Locals {
      requestId?: string;
      auth?: AuthContext;
    }
  }
}

export {};
