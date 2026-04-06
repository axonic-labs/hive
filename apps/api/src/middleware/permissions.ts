import type { Request, Response, NextFunction } from 'express';
import { getSpacePermissions } from '../config/manager.js';
import type { PermissionGrant } from '@hive/shared';

export function getUserGrantsForSpace(userId: string, space: string): PermissionGrant[] {
  const perms = getSpacePermissions(space);
  const entry = perms.find(p => p.user_id === userId);
  return entry?.grants ?? [];
}

export function canAccessPath(grants: PermissionGrant[], filePath: string, requiredAccess: 'read' | 'read_write'): boolean {
  return grants.some(g => {
    if (requiredAccess === 'read_write' && g.access === 'read') return false;
    if (g.path === '*') return true;
    const normalizedGrantPath = g.path.endsWith('/') ? g.path : g.path + '/';
    const normalizedFilePath = filePath.endsWith('/') ? filePath : filePath + '/';
    return normalizedFilePath.startsWith(normalizedGrantPath) || filePath === g.path.replace(/\/$/, '');
  });
}

export function checkPermission(requiredAccess: 'read' | 'read_write') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.user!.is_admin) { next(); return; }

    const space = Array.isArray(req.params.space) ? req.params.space[0] : req.params.space;
    const rawPath = req.params.path;
    const filePath = Array.isArray(rawPath) ? rawPath.join('/') : rawPath || '';
    const grants = getUserGrantsForSpace(req.user!.id, space);

    if (!canAccessPath(grants, filePath, requiredAccess)) {
      res.status(403).json({ error: 'Forbidden', status: 403 });
      return;
    }
    next();
  };
}

export function getPermittedPrefixes(userId: string, space: string): string[] | '*' {
  const grants = getUserGrantsForSpace(userId, space);
  if (grants.length === 0) return [];
  if (grants.some(g => g.path === '*')) return '*';
  return grants.map(g => g.path);
}
