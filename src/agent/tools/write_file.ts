import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * write_file 工具的具体实现（纯函数，方便单元测试）
 * 创建新文件或重写已有文件；路径安全由 agent 层的权限模块统一把关
 */
export async function writeLocalFile(filePath: string, content: string): Promise<string> {
  await fs.mkdir(path.dirname(path.resolve(filePath)), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
  return `文件已写入: ${filePath}（${content.length} 字符）`;
}
