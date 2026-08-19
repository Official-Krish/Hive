import { z } from "zod";

export const fileModifiedSchema = z.object({
  type: z.literal("file.modified"),
  timestamp: z.string().datetime(),
  path: z.string().max(2000),
  repository: z.string().min(1).optional(),
  branch: z.string().min(1).optional(),
  changeType: z.enum(["modified", "created", "deleted"]).optional(),
});

export const filesystemEventSchema = fileModifiedSchema;
export type FilesystemEvent = z.infer<typeof filesystemEventSchema>;
