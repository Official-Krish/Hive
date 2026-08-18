import { randomUUID } from "node:crypto";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { env } from "../config/env";
import { UnauthorizedError } from "../core/errors";

export interface AccessTokenPayload {
  sub: string;
  deviceId?: string;
  type: "access";
  jti: string;
}

const ISSUER = "hive";
const AUDIENCE = "hive-api";

export function signAccessToken(payload: {
  sub: string;
  deviceId?: string;
}): string {
  return jwt.sign(
    { type: "access", jti: randomUUID(), ...payload },
    env.ACCESS_TOKEN_SECRET,
    {
      algorithm: "HS256",
      expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
      issuer: ISSUER,
      audience: AUDIENCE,
    },
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.ACCESS_TOKEN_SECRET, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof decoded === "string") {
      throw new Error("Unexpected token payload");
    }
    const { sub, type, jti, deviceId } = decoded as JwtPayload & {
      type?: string;
      deviceId?: string;
    };
    if (
      type !== "access" ||
      typeof sub !== "string" ||
      typeof jti !== "string"
    ) {
      throw new Error("Unexpected token payload");
    }
    return { sub, type: "access", jti, deviceId };
  } catch {
    throw new UnauthorizedError("Invalid or expired access token");
  }
}
