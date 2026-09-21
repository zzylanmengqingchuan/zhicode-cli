import * as path from 'node:path';
import { tools } from '../tools.js';
import { isDangerousPath, normalizePath } from './is-dangerous-path.js';

export type PermissionAction = 'allow' | 'confirm' | 'block';

/**
 * 工具调用前的权限判定：
 * - read/write 级别：
 *   - 没有 filepath 参数 → 直接执行
 *   - filepath 在项目目录内 → 直接执行
 *   - filepath 是危险路径 → 阻止执行
 *   - 其他（项目外的普通路径）→ 询问用户
 * - 其他级别（exec / network / db）→ 询问用户
 */
export function evaluateToolPermission(
  toolName: string,
  args: unknown,
): { action: PermissionAction; filepath?: string } {
  const tool = tools.find((t) => t.name === toolName);
  const level = (tool as { permission_level?: string } | undefined)?.permission_level;

  if (level !== 'read' && level !== 'write') {
    return { action: 'confirm' };
  }

  const filepath =
    (args as { filePath?: string; filepath?: string } | null | undefined)?.filePath ??
    (args as { filepath?: string } | null | undefined)?.filepath;

  if (!filepath) {
    return { action: 'allow' };
  }

  const abs = normalizePath(filepath);
  const cwd = normalizePath(process.cwd());
  if (abs === cwd || abs.startsWith(cwd + path.sep)) {
    return { action: 'allow', filepath: abs };
  }

  if (isDangerousPath(filepath)) {
    return { action: 'block', filepath: abs };
  }

  return { action: 'confirm', filepath: abs };
}
