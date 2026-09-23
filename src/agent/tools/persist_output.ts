import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

/** 大体积工具输出的落盘目录：~/.zhiwen/.tool_output（用户主目录下，全局共享，跨平台） */
export const TOOL_OUTPUT_DIR = path.join(os.homedir(), '.zhiwen', '.tool_output');

const MAX_INLINE_OUTPUT = 50000;
const PREVIEW_LENGTH = 2000;

/**
 * 工具输出超长时把完整内容写入 ~/.zhiwen/.tool_output/ 文件，
 * 返回给模型的内容替换为「文件路径 + 前 2000 字预览」，避免撑爆 Context
 */
export async function maybePersistedOutput(
  content: string,
  toolCallId: string,
): Promise<string> {
  if (content.length <= MAX_INLINE_OUTPUT) return content;

  await fs.mkdir(TOOL_OUTPUT_DIR, { recursive: true });
  const filePath = path.join(TOOL_OUTPUT_DIR, `tool_output_${toolCallId}.txt`);
  await fs.writeFile(filePath, content, 'utf-8');

  return `<persisted-output>
Output too large (${(content.length / 1024).toFixed(1)}KB).
Full output saved to: ${filePath}
If you need the complete content, it is recommended to read it in segments

Preview (first 2KB):
${content.slice(0, PREVIEW_LENGTH)}
...
</persisted-output>`;
}
