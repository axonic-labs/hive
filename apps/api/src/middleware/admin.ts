import type { Request, Response, NextFunction } from 'express';

export function admin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.is_admin) {
    res.status(403).json({ error: 'Admin access required', status: 403 });
    return;
  }
  next();
}
