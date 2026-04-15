import { getSpaceConfig } from '../config/manager.js';
import type { FileProvider } from './types.js';
import { PostgresFileProvider } from './postgres/index.js';
import { GitFileProvider } from './git/index.js';

const providers = new Map<string, FileProvider>();

export function getProvider(space: string): FileProvider {
  const cached = providers.get(space);
  if (cached) return cached;

  const config = getSpaceConfig(space);
  if (!config) throw new Error(`No config for space "${space}"`);

  let provider: FileProvider;

  if (config.provider === 'postgres') {
    provider = new PostgresFileProvider(space);
  } else if (config.provider === 'git') {
    provider = new GitFileProvider(space, config);
  } else {
    throw new Error(`Unsupported provider: ${(config as any).provider}`);
  }

  providers.set(space, provider);
  return provider;
}

export function removeProvider(space: string): void {
  providers.delete(space);
}
