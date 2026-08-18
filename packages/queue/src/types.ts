export interface JobEnvelope {
  id: string;
  name: string;
  payload: unknown;
  attempts: number;
  createdAt: number;
}

export function createJob(name: string, payload: unknown): JobEnvelope {
  return {
    id: crypto.randomUUID(),
    name,
    payload,
    attempts: 0,
    createdAt: Date.now(),
  };
}

export function serializeJob(job: JobEnvelope): string {
  return JSON.stringify(job);
}

export function parseJob(raw: string): JobEnvelope | null {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof value.id !== "string" ||
      typeof value.name !== "string" ||
      typeof value.attempts !== "number" ||
      typeof value.createdAt !== "number"
    ) {
      return null;
    }
    return {
      id: value.id,
      name: value.name,
      payload: value.payload,
      attempts: value.attempts,
      createdAt: value.createdAt,
    };
  } catch {
    return null;
  }
}
