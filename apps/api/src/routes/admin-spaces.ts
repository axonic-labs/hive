import { Router } from 'express';
import git from 'isomorphic-git';
import fs from 'node:fs';
import { listSpaces, saveSpaceConfig, deleteSpaceDir, getSpacePermissions, saveSpacePermissions, getSpaceConfig, spaceRepoDir } from '../config/manager.js';
import { validateSpaceName, createSpaceTable, dropSpaceTable, createChatlogTable, dropChatlogTable } from '../db/spaces.js';
import { getPool, removePool, testConnection } from '../db/pools.js';
import { removeProvider } from '../providers/resolve.js';
import { badRequest, notFound } from '../middleware/error-handler.js';

export const adminSpacesRouter = Router();

adminSpacesRouter.get('/', (_req, res) => {
  res.json(listSpaces());
});

adminSpacesRouter.post('/', async (req, res, next) => {
  try {
    const { name, kind, provider, database_url, remote_url, remote_branch } = req.body;

    if (!name || !validateSpaceName(name)) {
      throw badRequest('Invalid space name. Use lowercase letters, numbers, underscores. Must start with a letter. Max 50 chars.');
    }

    const spaceKind = kind || 'files';
    const spaceProvider = provider || req.body.type || 'postgres';

    if (!['files', 'chatlog'].includes(spaceKind)) {
      throw badRequest('kind must be "files" or "chatlog"');
    }
    if (spaceProvider !== 'postgres' && spaceProvider !== 'git') {
      throw badRequest('Provider must be "postgres" or "git"');
    }
    if (spaceKind === 'chatlog' && spaceProvider !== 'postgres') {
      throw badRequest('Chatlog spaces only support postgres provider');
    }

    if (spaceProvider === 'postgres') {
      if (!database_url) throw badRequest('database_url is required for postgres provider');

      const connError = await testConnection(database_url);
      if (connError) throw badRequest(`Could not connect: ${connError}`);

      saveSpaceConfig(name, { kind: spaceKind, provider: 'postgres', database_url } as any);

      const pool = getPool(name);
      if (spaceKind === 'chatlog') {
        await createChatlogTable(pool, name);
      } else {
        await createSpaceTable(pool, name);
      }
    } else {
      // Git provider (files only)
      const config: Record<string, string> = { kind: 'files', provider: 'git' };
      if (remote_url) config.remote_url = remote_url;
      if (remote_branch) config.remote_branch = remote_branch;
      saveSpaceConfig(name, config as any);

      // Init git repo
      const dir = spaceRepoDir(name);
      fs.mkdirSync(dir, { recursive: true });
      await git.init({ fs, dir });
    }

    res.status(201).json({ name, kind: spaceKind, provider: spaceProvider });
  } catch (err) {
    next(err);
  }
});

adminSpacesRouter.delete('/:space', async (req, res, next) => {
  try {
    const { space } = req.params;
    const config = getSpaceConfig(space);
    if (!config) throw notFound(`Space "${space}" not found`);

    if (config.provider === 'postgres') {
      try {
        const pool = getPool(space);
        if (config.kind === 'chatlog') {
          await dropChatlogTable(pool, space);
        } else {
          await dropSpaceTable(pool, space);
        }
      } catch {
        // Table may not exist, continue with cleanup
      }
      await removePool(space);
    }

    removeProvider(space);
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
