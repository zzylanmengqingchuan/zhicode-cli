import * as fs from 'node:fs/promises';
import { resolveInCwd } from './safe-path.js';

/**
 * read_file 工具的具体实现（纯函数，方便单元测试）
 * 读取当前目录下的文件内容，路径越界会被 resolveInCwd 拦截
 */
export async function readLocalFile(filePath: string): Promise<string> {
  const abs = resolveInCwd(filePath);
  const stat = await fs.stat(abs);
  if (!stat.isFile()) {
    throw new Error(`不是文件: ${filePath}`);
  }
  return fs.readFile(abs, 'utf-8');
}
