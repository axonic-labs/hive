import { Router } from 'express';
import { listSpaces, saveSpaceConfig, deleteSpaceDir, getSpacePermissions, saveSpacePermissions, getSpaceConfig } from '../config/manager.js';
import { validateSpaceName, createSpaceTable, dropSpaceTable, createChatlogTable, dropChatlogTable } from '../db/spaces.js';
import { getPool, removePool, testConnection } from '../db/pools.js';
import { badRequest, notFound } from '../middleware/error-handler.js';

export const adminSpacesRouter = Router();

adminSpacesRouter.get('/', (_req, res) => {
  const spaces = listSpaces().map(name => {
    const config = getSpaceConfig(name);
    return { name, schema: config?.schema || 'files' };
  });
  res.json(spaces);
});

adminSpacesRouter.post('/', async (req, res, next) => {
  try {
    const { name, type, database_url, schema } = req.body;
    const spaceSchema = schema || 'files';

    if (!name || !validateSpaceName(name)) {
      throw badRequest('Invalid space name. Use lowercase letters, numbers, underscores. Must start with a letter. Max 50 chars.');
    }
    if (type !== 'postgres') {
      throw badRequest('Only "postgres" type is supported');
    }
    if (!database_url) {
      throw badRequest('database_url is required');
    }
    if (!['files', 'chatlog'].includes(spaceSchema)) {
      throw badRequest('schema must be "files" or "chatlog"');
    }

    const connError = await testConnection(database_url);
    if (connError) {
      throw badRequest(`Could not connect: ${connError}`);
    }

    saveSpaceConfig(name, { type, database_url, schema: spaceSchema });

    const pool = getPool(name);
    if (spaceSchema === 'chatlog') {
      await createChatlogTable(pool, name);
    } else {
      await createSpaceTable(pool, name);
    }

    res.status(201).json({ name, type, schema: spaceSchema });
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
      if ((config.schema || 'files') === 'chatlog') {
        await dropChatlogTable(pool, space);
      } else {
        await dropSpaceTable(pool, space);
      }
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
