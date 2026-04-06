import { Router, type Request } from 'express';
import { getPool } from '../db/pools.js';
import { createMessage, listMessages, deleteMessage, listThreads, deleteThread, searchMessages } from '../db/messages.js';
import { checkSpaceAccess } from '../middleware/permissions.js';
import { badRequest, notFound } from '../middleware/error-handler.js';

export const chatDataRouter = Router({ mergeParams: true });

chatDataRouter.use(checkSpaceAccess());

function getSpace(req: Request): string {
  const s = req.params.space;
  return Array.isArray(s) ? s[0] : s;
}

// Post a message
chatDataRouter.post('/messages', async (req, res, next) => {
  try {
    const space = getSpace(req);
    const { thread, author, content, source } = req.body;

    if (!author || typeof author !== 'string') throw badRequest('author is required');
    if (!content || typeof content !== 'string') throw badRequest('content is required');

    const pool = getPool(space);
    const msg = await createMessage(pool, space, {
      thread,
      author,
      content,
      source,
      created_by: req.user!.id,
    });
    res.status(201).json(msg);
  } catch (err) {
    next(err);
  }
});

// List messages
chatDataRouter.get('/messages', async (req, res, next) => {
  try {
    const space = getSpace(req);
    const thread = req.query.thread as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    const pool = getPool(space);
    const messages = await listMessages(pool, space, thread, limit, offset);
    res.json(messages);
  } catch (err) {
    next(err);
  }
});

// Delete message
chatDataRouter.delete('/messages/:id', async (req, res, next) => {
  try {
    const space = getSpace(req);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const pool = getPool(space);
    const deleted = await deleteMessage(pool, space, id);
    if (!deleted) throw notFound('Message not found');
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

// List threads
chatDataRouter.get('/threads', async (req, res, next) => {
  try {
    const space = getSpace(req);
    const pool = getPool(space);
    const threads = await listThreads(pool, space);
    res.json(threads);
  } catch (err) {
    next(err);
  }
});

// Delete thread
chatDataRouter.delete('/threads/:thread', async (req, res, next) => {
  try {
    const space = getSpace(req);
    const thread = decodeURIComponent(Array.isArray(req.params.thread) ? req.params.thread[0] : req.params.thread);

    const pool = getPool(space);
    const count = await deleteThread(pool, space, thread);
    res.json({ deleted: count });
  } catch (err) {
    next(err);
  }
});

// Search messages
chatDataRouter.get('/search', async (req, res, next) => {
  try {
    const space = getSpace(req);
    const q = req.query.q as string;
    if (!q) throw badRequest('q query parameter is required');

    const pool = getPool(space);
    const results = await searchMessages(pool, space, q);
    res.json(results);
  } catch (err) {
    next(err);
  }
});
