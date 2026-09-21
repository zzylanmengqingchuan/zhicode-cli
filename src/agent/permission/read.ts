import { isDangerousPath, normalizePath } from './is-dangerous-path.js';
import { extractFilepath } from './util.js';

export interface ReadPermissionResult {
  action: 'allow' | 'block';
  filepath?: string;
}

/**
 * read 级别工具的权限判定：
 * 只要 filepath 不是敏感目录就直接执行，不用用户确认；敏感目录直接阻止
 */
export function evaluateReadPermission(args: unknown): ReadPermissionResult {
  const filepath = extractFilepath(args);
  if (!filepath) return { action: 'allow' };

  if (isDangerousPath(filepath)) {
    return { action: 'block', filepath: normalizePath(filepath) };
  }
  return { action: 'allow', filepath: normalizePath(filepath) };
}
