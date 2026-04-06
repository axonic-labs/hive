import { Router } from 'express';
import { getUserByApiKey } from '../config/manager.js';

export const authRouter = Router();

authRouter.post('/verify', (req, res) => {
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

  res.json({
    id: user.id,
    name: user.name,
    is_admin: user.is_admin,
    created_at: user.created_at,
  });
});
