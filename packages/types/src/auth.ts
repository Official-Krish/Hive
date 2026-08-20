import { z } from "zod";

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a digit");

export const registerInputSchema = z.object({
  email: z.email("Invalid email").max(255),
  password,
  name: z.string().trim().min(1, "Name is required").max(100),
});
export type RegisterInput = z.infer<typeof registerInputSchema>;

export const loginInputSchema = z.object({
  email: z.email("Invalid email").max(255),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const githubTokenSchema = z.object({
  accessToken: z.string().min(1).max(2048),
});
export type GithubTokenInput = z.infer<typeof githubTokenSchema>;

export const changePasswordInputSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: password,
});
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;

export const updateProfileInputSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  avatarUrl: z.url("Invalid URL").max(2048).nullable().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>;

export const refreshSessionInputSchema = z.object({});
export type RefreshSessionInput = z.infer<typeof refreshSessionInputSchema>;

export interface AuthResponseData {
  user: PublicUser;
  /** Access token lifetime in seconds */
  accessTokenExpiresIn: number;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  createdAt: string;
}
