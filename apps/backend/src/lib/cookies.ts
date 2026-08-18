import type { CookieOptions, Response } from "express";
import { env } from "../config/env";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

const baseOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: "lax",
});

export function setAccessTokenCookie(
  res: Response,
  token: string,
  maxAgeSeconds: number,
): void {
  res.cookie(ACCESS_COOKIE, token, {
    ...baseOptions(),
    path: "/",
    maxAge: maxAgeSeconds * 1000,
  });
}

export function setRefreshTokenCookie(
  res: Response,
  token: string,
  maxAgeSeconds: number,
): void {
  res.cookie(REFRESH_COOKIE, token, {
    ...baseOptions(),
    path: "/api/auth",
    maxAge: maxAgeSeconds * 1000,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { ...baseOptions(), path: "/" });
  res.clearCookie(REFRESH_COOKIE, { ...baseOptions(), path: "/api/auth" });
}
