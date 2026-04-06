import type { Request, Response, NextFunction } from 'express';
import { getUserByApiKey } from '../config/manager.js';
import type { User } from '@hive/shared';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export function auth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header', status: 401 });
    return;
  }

  const apiKey = header.slice(7);
  const user = getUserByApiKey(apiKey);
  if (!user) {
    res.status(401).json({ error: 'Invalid API key', status: 401 });
    return;
  }

  req.user = user;
  next();
}
