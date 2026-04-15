import { Router } from 'express';
import { getSpaceConfig } from '../config/manager.js';
import { getProvider } from '../providers/resolve.js';
import { parseFilePath } from '../db/files.js';
import { checkPermission, getPermittedPrefixes } from '../middleware/permissions.js';
import { notFound, badRequest } from '../middleware/error-handler.js';
import type { FileVersion } from '../providers/types.js';

import { chatDataRouter } from './chat-data.js';

export const dataRouter = Router();

function param(val: string | string[] | undefined): string {
  return Array.isArray(val) ? val.join('/') : val ?? '';
}

function requireSpace(space: string) {
  if (!getSpaceConfig(space)) throw notFound(`Space "${space}" not found`);
}

// Kind-based dispatch: forward chatlog spaces to chat router
dataRouter.use('/:space', (req, res, next) => {
  const space = param(req.params.space);
  const config = getSpaceConfig(space);
  if (config && config.kind === 'chatlog') {
    return chatDataRouter(req, res, () => {
      res.status(404).json({ error: 'Not found', status: 404 });
    });
  }
  next();
});

// List files
dataRouter.get('/:space/files', async (req, res, next) => {
  try {
    const space = param(req.params.space);
    requireSpace(space);
    const prefix = req.query.prefix as string | undefined;

    const prefixes = req.user!.is_admin ? '*' : getPermittedPrefixes(req.user!.id, space);
    if (prefixes !== '*' && prefixes.length === 0) {
      res.json([]);
      return;
    }

    const provider = getProvider(space);
    const files = await provider.listFiles(prefix, prefixes);
    res.json(files);
  } catch (err) {
    next(err);
  }
});

// Create file
dataRouter.post('/:space/files', checkPermission('read_write'), async (req, res, next) => {
  try {
    const space = param(req.params.space);
    requireSpace(space);
    const { path: filePath, filename, content } = req.body;

    if (!filename || typeof filename !== 'string') throw badRequest('filename is required');
    if (typeof content !== 'string') throw badRequest('content must be a string');

    const provider = getProvider(space);
    try {
      const file = await provider.createFile(filePath || '', filename, content);
      res.status(201).json(file);
    } catch (err) {
      if (err instanceof Error && err.message.includes('already exists')) {
        throw badRequest(err.message);
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

// Read file
dataRouter.get('/:space/files/*path', checkPermission('read'), async (req, res, next) => {
  try {
    const space = param(req.params.space);
    requireSpace(space);
    const { path: filePath, filename } = parseFilePath(param(req.params.path));

    const provider = getProvider(space);
    const file = await provider.readFile(filePath, filename);
    if (!file) throw notFound('File not found');

    if (file.content_text !== null) {
      res.type('text/plain').send(file.content_text);
    } else if (file.content_blob !== null) {
      res.type('application/octet-stream').send(file.content_blob);
    } else {
      res.type('text/plain').send('');
    }
  } catch (err) {
    next(err);
  }
});

// Write/overwrite file
dataRouter.put('/:space/files/*path', checkPermission('read_write'), async (req, res, next) => {
  try {
    const space = param(req.params.space);
    requireSpace(space);
    const { path: filePath, filename } = parseFilePath(param(req.params.path));
    const content = typeof req.body === 'string' ? req.body : req.body?.content;

    if (typeof content !== 'string') throw badRequest('Content must be provided as text body or { content: string }');

    const provider = getProvider(space);
    const file = await provider.writeFile(filePath, filename, content);
    res.json(file);
  } catch (err) {
    next(err);
  }
});

// Append to file
dataRouter.patch('/:space/files/*path', checkPermission('read_write'), async (req, res, next) => {
  try {
    const space = param(req.params.space);
    requireSpace(space);
    const { path: filePath, filename } = parseFilePath(param(req.params.path));
    const content = req.body?.content;

    if (typeof content !== 'string') throw badRequest('{ content: string } is required');

    const provider = getProvider(space);
    const file = await provider.appendFile(filePath, filename, content);
    res.json(file);
  } catch (err) {
    next(err);
  }
});

// Delete file
dataRouter.delete('/:space/files/*path', checkPermission('read_write'), async (req, res, next) => {
  try {
    const space = param(req.params.space);
    requireSpace(space);
    const { path: filePath, filename } = parseFilePath(param(req.params.path));

    const provider = getProvider(space);
    const deleted = await provider.deleteFile(filePath, filename);
    if (!deleted) throw notFound('File not found');
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

// Delete folder
dataRouter.delete('/:space/folders/*path', checkPermission('read_write'), async (req, res, next) => {
  try {
    const space = param(req.params.space);
    requireSpace(space);
    const folderPath = param(req.params.path);

    const provider = getProvider(space);
    const count = await provider.deleteFolder(folderPath);
    res.json({ deleted: count });
  } catch (err) {
    next(err);
  }
});

// Search
dataRouter.get('/:space/search', async (req, res, next) => {
  try {
    const space = param(req.params.space);
    requireSpace(space);
    const q = req.query.q as string;
    if (!q) throw badRequest('q query parameter is required');

    const prefixes = req.user!.is_admin ? '*' : getPermittedPrefixes(req.user!.id, space);
    if (prefixes !== '*' && prefixes.length === 0) {
      res.json([]);
      return;
    }

    const provider = getProvider(space);
    const results = await provider.searchFiles(q, prefixes);
    res.json(results);
  } catch (err) {
    next(err);
  }
});

// --- Version history endpoints (git-only) ---

// List file history
dataRouter.get('/:space/history/*path', checkPermission('read'), async (req, res, next) => {
  try {
    const space = param(req.params.space);
    requireSpace(space);
    const provider = getProvider(space);
    if (!provider.capabilities.history) {
      throw notFound('Version history is not available for this space type');
    }

    const fullPath = param(req.params.path);
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    // Access getFileHistory via the git provider
    const gitProvider = provider as any;
    const history: FileVersion[] = await gitProvider.getFileHistory(fullPath, limit);
    res.json(history);
  } catch (err) {
    next(err);
  }
});

// Read file at specific version
dataRouter.get('/:space/versions/:oid/*path', checkPermission('read'), async (req, res, next) => {
  try {
    const space = param(req.params.space);
    requireSpace(space);
    const provider = getProvider(space);
    if (!provider.capabilities.history) {
      throw notFound('Version history is not available for this space type');
    }

    const oid = req.params.oid;
    const fullPath = param(req.params.path);

    const gitProvider = provider as any;
    const content: string | null = await gitProvider.getFileAtVersion(fullPath, oid);
    if (content === null) throw notFound('File not found at this version');

    res.type('text/plain').send(content);
  } catch (err) {
    next(err);
  }
});

// Diff between two versions
dataRouter.get('/:space/diff/:oid1/:oid2/*path', checkPermission('read'), async (req, res, next) => {
  try {
    const space = param(req.params.space);
    requireSpace(space);
    const provider = getProvider(space);
    if (!provider.capabilities.history) {
      throw notFound('Version history is not available for this space type');
    }

    const { oid1, oid2 } = req.params;
    const fullPath = param(req.params.path);

    const gitProvider = provider as any;
    const diff = await gitProvider.diffVersions(fullPath, oid1, oid2);
    res.json(diff);
  } catch (err) {
    next(err);
  }
});

// Restore file to specific version
dataRouter.post('/:space/restore/:oid/*path', checkPermission('read_write'), async (req, res, next) => {
  try {
    const space = param(req.params.space);
    requireSpace(space);
    const provider = getProvider(space);
    if (!provider.capabilities.history) {
      throw notFound('Version history is not available for this space type');
    }

    const oid = req.params.oid;
    const fullPath = param(req.params.path);

    const gitProvider = provider as any;
    const file = await gitProvider.restoreVersion(fullPath, oid);
    res.json(file);
  } catch (err) {
    next(err);
  }
});

// Sync (push to remote)
dataRouter.post('/:space/sync', checkPermission('read_write'), async (req, res, next) => {
  try {
    const space = param(req.params.space);
    requireSpace(space);
    const provider = getProvider(space);
    if (!provider.capabilities.remoteSync) {
      throw notFound('Remote sync is not available for this space');
    }

    const gitProvider = provider as any;
    await gitProvider.sync();
    res.json({ synced: true });
  } catch (err) {
    next(err);
  }
});
