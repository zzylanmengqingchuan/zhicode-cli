import * as path from 'node:path';

/**
 * 将用户给出的路径解析为绝对路径，并限制必须在当前工作目录内。
 * 越界（如 ../、绝对路径指向别处）时抛错，防止 agent 读写系统任意文件。
 */
export function resolveInCwd(filePath: string): string {
  const cwd = process.cwd();
  const abs = path.resolve(cwd, filePath);
  if (abs !== cwd && !abs.startsWith(cwd + path.sep)) {
    throw new Error(`只允许访问当前目录下的文件: ${filePath}`);
  }
  return abs;
}
