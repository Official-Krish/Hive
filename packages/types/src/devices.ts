import { z } from "zod";

export const deviceTypeSchema = z.enum(["laptop", "desktop", "ci", "server"]);
export const deviceStatusSchema = z.enum(["active", "revoked", "expired"]);

export const registerDeviceInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  type: deviceTypeSchema.optional(),
  os: z.string().trim().max(100).optional(),
  arch: z.string().trim().max(100).optional(),
});
export type RegisterDeviceInput = z.infer<typeof registerDeviceInputSchema>;

export interface DeviceSummary {
  id: string;
  name: string;
  type: z.infer<typeof deviceTypeSchema>;
  os: string | null;
  arch: string | null;
  status: z.infer<typeof deviceStatusSchema>;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface DeviceRegistered {
  device: DeviceSummary;
  /** Plaintext device token — shown once on registration only. */
  token: string;
}
