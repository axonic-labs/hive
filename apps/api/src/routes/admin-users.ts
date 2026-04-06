import { Router } from 'express';
import crypto from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { getUsers, saveUsers, getUserById } from '../config/manager.js';
import { badRequest, notFound } from '../middleware/error-handler.js';

export const adminUsersRouter = Router();

adminUsersRouter.get('/', (_req, res) => {
  const users = getUsers().map(({ api_key: _, ...u }) => u);
  res.json(users);
});

adminUsersRouter.post('/', (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw badRequest('name is required');
    }

    const apiKey = 'hive_' + crypto.randomBytes(16).toString('hex');
    const user = {
      id: uuidv4(),
      name: name.trim(),
      api_key: apiKey,
      is_admin: false,
      created_at: new Date().toISOString(),
    };

    const users = getUsers();
    users.push(user);
    saveUsers(users);

    // Return API key only on creation
    res.status(201).json({
      id: user.id,
      name: user.name,
      is_admin: user.is_admin,
      api_key: apiKey,
      created_at: user.created_at,
    });
  } catch (err) {
    next(err);
  }
});

adminUsersRouter.get('/:id', (req, res, next) => {
  try {
    const user = getUserById(req.params.id);
    if (!user) throw notFound('User not found');
    const { api_key: _, ...safe } = user;
    res.json(safe);
  } catch (err) {
    next(err);
  }
});

adminUsersRouter.delete('/:id', (req, res, next) => {
  try {
    const users = getUsers();
    const idx = users.findIndex(u => u.id === req.params.id);
    if (idx === -1) throw notFound('User not found');
    if (users[idx].is_admin) throw badRequest('Cannot delete admin user');

    users.splice(idx, 1);
    saveUsers(users);
    res.json({ deleted: req.params.id });
  } catch (err) {
    next(err);
  }
});
