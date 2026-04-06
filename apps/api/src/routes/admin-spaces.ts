import { Router } from 'express';
import { listSpaces, saveSpaceConfig, deleteSpaceDir, getSpacePermissions, saveSpacePermissions, getSpaceConfig } from '../config/manager.js';
import { validateSpaceName, createSpaceTable, dropSpaceTable } from '../db/spaces.js';
import { getPool, removePool, testConnection } from '../db/pools.js';
import { badRequest, notFound } from '../middleware/error-handler.js';

export const adminSpacesRouter = Router();

adminSpacesRouter.get('/', (_req, res) => {
  const spaces = listSpaces().map(name => ({ name }));
  res.json(spaces);
});

adminSpacesRouter.post('/', async (req, res, next) => {
  try {
    const { name, type, database_url } = req.body;

    if (!name || !validateSpaceName(name)) {
      throw badRequest('Invalid space name. Use lowercase letters, numbers, underscores. Must start with a letter. Max 50 chars.');
    }
    if (type !== 'postgres') {
      throw badRequest('Only "postgres" type is supported');
    }
    if (!database_url) {
      throw badRequest('database_url is required');
    }

    const connected = await testConnection(database_url);
    if (!connected) {
      throw badRequest('Could not connect to the provided database URL');
    }

    saveSpaceConfig(name, { type, database_url });

    const pool = getPool(name);
    await createSpaceTable(pool, name);

    res.status(201).json({ name, type });
  } catch (err) {
    next(err);
  }
});

adminSpacesRouter.delete('/:space', async (req, res, next) => {
  try {
    const { space } = req.params;
    const config = getSpaceConfig(space);
    if (!config) throw notFound(`Space "${space}" not found`);

    try {
      const pool = getPool(space);
      await dropSpaceTable(pool, space);
    } catch {
      // Table may not exist, continue with cleanup
    }

    await removePool(space);
    deleteSpaceDir(space);

    res.json({ deleted: space });
  } catch (err) {
    next(err);
  }
});

// Permissions
adminSpacesRouter.get('/:space/permissions', (req, res, next) => {
  try {
    const { space } = req.params;
    const config = getSpaceConfig(space);
    if (!config) throw notFound(`Space "${space}" not found`);
    res.json(getSpacePermissions(space));
  } catch (err) {
    next(err);
  }
});

adminSpacesRouter.put('/:space/permissions', (req, res, next) => {
  try {
    const { space } = req.params;
    const config = getSpaceConfig(space);
    if (!config) throw notFound(`Space "${space}" not found`);
    saveSpacePermissions(space, req.body);
    res.json(getSpacePermissions(space));
  } catch (err) {
    next(err);
  }
});
