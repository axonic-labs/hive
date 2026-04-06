import type { Request, Response, NextFunction } from 'express';

export class HiveError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function notFound(msg = 'Not found') { return new HiveError(404, msg); }
export function forbidden(msg = 'Forbidden') { return new HiveError(403, msg); }
export function badRequest(msg = 'Bad request') { return new HiveError(400, msg); }

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HiveError) {
    res.status(err.status).json({ error: err.message, status: err.status });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error', status: 500 });
}
