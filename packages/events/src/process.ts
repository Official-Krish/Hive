import { z } from "zod";

export const processStartedSchema = z.object({
  type: z.literal("process.started"),
  timestamp: z.string().datetime(),
  pid: z.number().int().positive(),
  ppid: z.number().int().positive().optional(),
  name: z.string().max(500).optional(),
  command: z.string().max(2000),
});

export const processStoppedSchema = z.object({
  type: z.literal("process.stopped"),
  timestamp: z.string().datetime(),
  pid: z.number().int().positive(),
  exitCode: z.number().int().optional(),
});

export const terminalCommandSchema = z.object({
  type: z.literal("terminal.command"),
  timestamp: z.string().datetime(),
  command: z.string().max(2000),
  pid: z.number().int().positive().optional(),
});

export const processEventSchema = z.discriminatedUnion("type", [
  processStartedSchema,
  processStoppedSchema,
  terminalCommandSchema,
]);
export type ProcessEvent = z.infer<typeof processEventSchema>;
