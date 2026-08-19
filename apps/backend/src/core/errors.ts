export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", details?: unknown) {
    super(400, "BAD_REQUEST", message, details);
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown) {
    super(400, "VALIDATION_ERROR", "Validation failed", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(401, "UNAUTHORIZED", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict", details?: unknown) {
    super(409, "CONFLICT", message, details);
  }
}

/** Raised when a workspace join requires an online collector device. */
export class DeviceRequiredError extends AppError {
  constructor(
    message = "Connect your collector before joining this workspace",
  ) {
    super(409, "DEVICE_REQUIRED", message);
  }
}

/** Raised when a control command targets a device that is not online. */
export class DeviceOfflineError extends AppError {
  constructor(message = "Device is offline") {
    super(409, "DEVICE_OFFLINE", message);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
