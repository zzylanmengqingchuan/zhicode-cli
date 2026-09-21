import { tool } from 'langchain';
import { z } from 'zod';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { searchWeb } from './tools/search.js';
import { readLocalFile } from './tools/read_file.js';
import { writeLocalFile } from './tools/write_file.js';
import { execCommand } from './tools/exec.js';
import { runJs } from './tools/run_js.js';
import { runPy } from './tools/run_py.js';
import { webSearch } from './tools/web_search.js';
import { webFetch } from './tools/web_fetch.js';
import { loadSkillContent } from './tools/load_skill.js';
import { createMemory } from './tools/memory_create.js';
import { retrieveMemories } from './tools/memory_retrieve.js';
import { deleteMemory } from './tools/memory_delete.js';
import { updateProfile } from './tools/profile_update.js';

/**
 * 工具注册中心：统一声明每个工具的 name / description / schema，
 * 具体实现见同目录下的各文件。新增工具时在这里注册并加入 tools 数组。
 */
export const search = tool(
  async ({ query }) => searchWeb(query),
  {
    name: 'search',
    description: 'Call to surf the web.',
    schema: z.object({
      query: z.string().describe('The query to use in your search.'),
    }),
  },
);

export const readFile = tool(
  async ({ filePath }) => readLocalFile(filePath),
  {
    name: 'read_file',
    description: '读取当前目录下的本地文件内容，返回文件文本',
    schema: z.object({
      filePath: z.string().describe('相对于当前目录的文件路径'),
    }),
  },
);

export const writeFile = tool(
  async ({ filePath, content }) => writeLocalFile(filePath, content),
  {
    name: 'write_file',
    description: '在当前目录下创建新文件或重写已有文件',
    schema: z.object({
      filePath: z.string().describe('相对于当前目录的文件路径'),
      content: z.string().describe('要写入文件的完整内容'),
    }),
  },
);

export const execTool = tool(
  async ({ command }) => execCommand(command),
  {
    name: 'exec',
    description: '在当前目录下执行 shell 命令并返回输出（禁止删除等危险操作）',
    schema: z.object({
      command: z.string().describe('要执行的 shell 命令'),
    }),
  },
);

export const runJsTool = tool(
  async ({ code }) => runJs(code),
  {
    name: 'run_js',
    description: '使用 Node.js 执行一段 JavaScript 代码，返回执行结果或报错信息',
    schema: z.object({
      code: z.string().describe('要执行的 JavaScript 代码'),
    }),
  },
);

export const webSearchTool = tool(
  async ({ query }) => webSearch(query),
  {
    name: 'web_search',
    description: '使用 Tavily 联网搜索真实信息，当问题需要最新/真实的外部资料时使用',
    schema: z.object({
      query: z.string().describe('搜索关键词'),
    }),
  },
);

export const webFetchTool = tool(
  async ({ url }) => webFetch(url),
  {
    name: 'web_fetch',
    description: '根据 URL 获取网络资源内容（如网页正文），失败时返回错误信息',
    schema: z.object({
      url: z.string().describe('要获取的 http/https 链接'),
    }),
  },
);

export const loadSkillTool = tool(
  async ({ name }) => loadSkillContent(name),
  {
    name: 'load_skill',
    description: '加载指定 skill 的完整内容（SKILL.md），每次只能加载一个',
    schema: z.object({
      name: z.string().describe('要加载的 skill 名称'),
    }),
  },
);

export const runPyTool = tool(
  async ({ code }) => runPy(code),
  {
    name: 'run_py',
    description: '使用 python3 执行一段 Python 代码，返回执行结果或报错信息',
    schema: z.object({
      code: z.string().describe('要执行的 Python 代码'),
    }),
  },
);

export const memoryCreateTool = tool(
  async ({ type, content, keywords, importance }, config) => {
    const sessionId = (config as { configurable?: { thread_id?: string } } | undefined)
      ?.configurable?.thread_id;
    return createMemory({ type, content, keywords, importance, sessionId });
  },
  {
    name: 'memory_create',
    description:
      '当用户分享了值得长期记住的信息时存储一条记忆，例如偏好（preference）、事实（fact）、事件（event）、技能（skill）',
    schema: z.object({
      type: z.enum(['fact', 'event', 'preference', 'skill']).describe('记忆类型'),
      content: z.string().describe('自然语言描述的记忆内容，方便拼进 prompt'),
      keywords: z.array(z.string()).optional().describe('用于检索的关键词'),
      importance: z.number().min(1).max(5).optional().describe('重要程度 1~5，默认 3'),
    }),
  },
);

export const memoryRetrieveTool = tool(
  async ({ keywords }) => retrieveMemories(keywords),
  {
    name: 'memory_retrieve',
    description:
      '当用户的问题涉及过去的记忆而当前对话中没有相关信息时，提炼关键词调用此工具检索长期记忆',
    schema: z.object({
      keywords: z.array(z.string()).describe('用于检索记忆的关键词列表'),
    }),
  },
);

export const memoryDeleteTool = tool(
  async ({ id }) => deleteMemory(id),
  {
    name: 'memory_delete',
    description: '当用户想要删除或遗忘某条记忆时，按 id 删除该记忆（id 可通过 memory_retrieve 检索结果获得）',
    schema: z.object({
      id: z.number().describe('要删除的记忆 id'),
    }),
  },
);

export const profileUpdateTool = tool(
  async ({ content }) => updateProfile(content),
  {
    name: 'profile_update',
    description:
      '更新用户画像（profile）。更新时必须保留 <profile_info> 中提到的其他已有信息，所有 profile 信息一起全量更新',
    schema: z.object({
      content: z.string().describe('完整的用户画像内容（全量，不是增量）'),
    }),
  },
);

export const tools = [
  search,
  readFile,
  writeFile,
  execTool,
  runJsTool,
  runPyTool,
  webSearchTool,
  webFetchTool,
  loadSkillTool,
  memoryCreateTool,
  memoryRetrieveTool,
  memoryDeleteTool,
  profileUpdateTool,
];

// —— 工具输出过大时的落盘处理 ————————————————————————————————

const MAX_INLINE_OUTPUT = 50000;
const PREVIEW_LENGTH = 2000;

/**
 * 工具输出超长时把完整内容写入 ./tool_output/ 文件，
 * 返回给模型的内容替换为「文件路径 + 前 2000 字预览」，避免撑爆 Context
 */
export async function maybePersistedOutput(
  content: string,
  toolCallId: string,
): Promise<string> {
  if (content.length <= MAX_INLINE_OUTPUT) return content;

  const dir = path.resolve(process.cwd(), 'tool_output');
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `tool_output_${toolCallId}.txt`);
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
