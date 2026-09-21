import * as path from 'node:path';
import { normalizePath } from './is-dangerous-path.js';

/**
 * 从工具参数中提取文件路径（兼容 filePath / filepath 两种命名）
 */
export function extractFilepath(args: unknown): string | undefined {
  const a = args as { filePath?: string; filepath?: string } | null | undefined;
  return a?.filePath ?? a?.filepath;
}

/**
 * 判断路径是否在项目目录（当前工作目录）内
 */
export function isInProjectDir(filepath: string): boolean {
  const abs = normalizePath(filepath);
  const cwd = normalizePath(process.cwd());
  return abs === cwd || abs.startsWith(cwd + path.sep);
}
