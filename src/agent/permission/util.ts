import * as path from 'node:path';
import { ZHIWEN_DIR } from '../config.js';
import { normalizePath } from './is-dangerous-path.js';

/**
 * 从工具参数中提取文件路径（兼容 filePath / filepath 两种命名）
 */
export function extractFilepath(args: unknown): string | undefined {
  const a = args as { filePath?: string; filepath?: string } | null | undefined;
  return a?.filePath ?? a?.filepath;
}

/**
 * 判断路径是否在免确认的工作空间内：
 * 项目目录（当前工作目录）或 ~/.zhiwen 用户目录
 */
export function isInProjectDir(filepath: string): boolean {
  const abs = normalizePath(filepath);
  const cwd = normalizePath(process.cwd());
  if (abs === cwd || abs.startsWith(cwd + path.sep)) return true;

  const zhiwenHome = normalizePath(ZHIWEN_DIR);
  return abs === zhiwenHome || abs.startsWith(zhiwenHome + path.sep);
}
