export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly isOperational: boolean;

  constructor(statusCode: number, code: string, message: string, opts?: { isOperational?: boolean }) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = opts?.isOperational ?? true;
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', code = 'BAD_REQUEST') {
    super(400, code, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found', code = 'NOT_FOUND') {
    super(404, code, message);
  }
}

export class UnsupportedMediaError extends AppError {
  constructor(message = 'Unsupported file type') {
    super(415, 'UNSUPPORTED_FILE', message);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = 'File too large') {
    super(413, 'FILE_TOO_LARGE', message);
  }
}
