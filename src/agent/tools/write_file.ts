import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { resolveInCwd } from './safe-path.js';

/**
 * write_file 工具的具体实现（纯函数，方便单元测试）
 * 在当前目录下创建新文件或重写已有文件，路径越界会被 resolveInCwd 拦截
 */
export async function writeLocalFile(filePath: string, content: string): Promise<string> {
  const abs = resolveInCwd(filePath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, 'utf-8');
  return `文件已写入: ${filePath}（${content.length} 字符）`;
}
