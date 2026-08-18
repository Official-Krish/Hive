import { Queue } from "@hive/queue";
import { logger } from "./logger";

export const queue = new Queue({ logger });
