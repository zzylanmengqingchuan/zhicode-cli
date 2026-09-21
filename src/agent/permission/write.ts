import { isDangerousPath, normalizePath } from './is-dangerous-path.js';
import { extractFilepath, isInProjectDir } from './util.js';

export interface WritePermissionResult {
  action: 'allow' | 'confirm' | 'block';
  filepath?: string;
}

/**
 * write 级别工具的权限判定：
 * - 没有 filepath → 直接执行
 * - filepath 在项目目录内 → 直接执行
 * - filepath 是危险路径 → 阻止执行
 * - 其他（项目外的普通路径）→ 询问用户
 */
export function evaluateWritePermission(args: unknown): WritePermissionResult {
  const filepath = extractFilepath(args);
  if (!filepath) return { action: 'allow' };

  const abs = normalizePath(filepath);
  if (isInProjectDir(filepath)) {
    return { action: 'allow', filepath: abs };
  }
  if (isDangerousPath(filepath)) {
    return { action: 'block', filepath: abs };
  }
  return { action: 'confirm', filepath: abs };
}
