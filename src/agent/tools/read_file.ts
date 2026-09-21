import * as fs from 'node:fs/promises';

/**
 * read_file 工具的具体实现（纯函数，方便单元测试）
 * 读取本地文件内容；路径安全由 agent 层的权限模块统一把关
 */
export async function readLocalFile(filePath: string): Promise<string> {
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) {
    throw new Error(`不是文件: ${filePath}`);
  }
  return fs.readFile(filePath, 'utf-8');
}
