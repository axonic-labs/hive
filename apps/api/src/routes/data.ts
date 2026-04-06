import { Router } from 'express';
import { getSpaceConfig } from '../config/manager.js';
import { getPool } from '../db/pools.js';
import { listFiles, readFile, createFile, writeFile, appendFile, deleteFile, deleteFolder, parseFilePath } from '../db/files.js';
import { searchFiles } from '../db/search.js';
import { checkPermission, getPermittedPrefixes } from '../middleware/permissions.js';
import { notFound, badRequest } from '../middleware/error-handler.js';

import { chatDataRouter } from './chat-data.js';

export const dataRouter = Router();

function param(val: string | string[] | undefined): string {
  return Array.isArray(val) ? val.join('/') : val ?? '';
}

function requireSpace(space: string) {
  if (!getSpaceConfig(space)) throw notFound(`Space "${space}" not found`);
}

// Schema-based dispatch: forward chatlog spaces to chat router
dataRouter.use('/:space', (req, res, next) => {
  const space = param(req.params.space);
  const config = getSpaceConfig(space);
  if (config && (config.schema || 'files') === 'chatlog') {
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

    const pool = getPool(space);
    const files = await listFiles(pool, space, prefix, prefixes);
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

    const pool = getPool(space);
    try {
      const file = await createFile(pool, space, filePath || '', filename, content);
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

    const pool = getPool(space);
    const file = await readFile(pool, space, filePath, filename);
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

    const pool = getPool(space);
    const file = await writeFile(pool, space, filePath, filename, content);
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

    const pool = getPool(space);
    const file = await appendFile(pool, space, filePath, filename, content);
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

    const pool = getPool(space);
    const deleted = await deleteFile(pool, space, filePath, filename);
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

    const pool = getPool(space);
    const count = await deleteFolder(pool, space, folderPath);
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

    const pool = getPool(space);
    const results = await searchFiles(pool, space, q, prefixes);
    res.json(results);
  } catch (err) {
    next(err);
  }
});
