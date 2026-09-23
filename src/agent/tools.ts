import { tool } from 'langchain';
import { z } from 'zod';
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
import { runSubAgent } from './tools/sub_agent.js';

/**
 * 工具注册中心：统一声明每个工具的 name / description / schema / permission_level，
 * 具体实现见同目录下的各文件。新增工具时在这里注册并加入 tools 数组。
 */

/** 权限级别：read 读文件 / write 写文件 / exec 执行命令 / network 网络请求 / db 数据库操作 */
export type PermissionLevel = 'read' | 'write' | 'exec' | 'network' | 'db';

/** 给工具附加 permission_level 属性（后续权限校验使用） */
function withPerm<T extends object>(
  t: T,
  level: PermissionLevel,
): T & { permission_level: PermissionLevel } {
  return Object.assign(t, { permission_level: level });
}

export const search = withPerm(
  tool(async ({ query }) => searchWeb(query), {
    name: 'search',
    description: 'Call to surf the web.',
    schema: z.object({
      query: z.string().describe('The query to use in your search.'),
    }),
  }),
  'network',
);

export const readFile = withPerm(
  tool(async ({ filePath }) => readLocalFile(filePath), {
    name: 'read_file',
    description: '读取本地文件内容，返回文件文本',
    schema: z.object({
      filePath: z.string().describe('文件路径'),
    }),
  }),
  'read',
);

export const writeFile = withPerm(
  tool(async ({ filePath, content }) => writeLocalFile(filePath, content), {
    name: 'write_file',
    description: '创建新文件或重写已有文件',
    schema: z.object({
      filePath: z.string().describe('文件路径'),
      content: z.string().describe('要写入文件的完整内容'),
    }),
  }),
  'write',
);

export const execTool = withPerm(
  tool(async ({ command }) => execCommand(command), {
    name: 'exec',
    description: '在当前目录下执行 shell 命令并返回输出',
    schema: z.object({
      command: z.string().describe('要执行的 shell 命令'),
    }),
  }),
  'exec',
);

export const runJsTool = withPerm(
  tool(async ({ code }) => runJs(code), {
    name: 'run_js',
    description: '使用 Node.js 执行一段 JavaScript 代码，返回执行结果或报错信息',
    schema: z.object({
      code: z.string().describe('要执行的 JavaScript 代码'),
    }),
  }),
  'exec',
);

export const webSearchTool = withPerm(
  tool(async ({ query }) => webSearch(query), {
    name: 'web_search',
    description: '使用 Tavily 联网搜索真实信息，当问题需要最新/真实的外部资料时使用',
    schema: z.object({
      query: z.string().describe('搜索关键词'),
    }),
  }),
  'network',
);

export const webFetchTool = withPerm(
  tool(async ({ url }) => webFetch(url), {
    name: 'web_fetch',
    description: '根据 URL 获取网络资源内容（如网页正文），失败时返回错误信息',
    schema: z.object({
      url: z.string().describe('要获取的 http/https 链接'),
    }),
  }),
  'network',
);

export const loadSkillTool = withPerm(
  tool(async ({ name }) => loadSkillContent(name), {
    name: 'load_skill',
    description: '加载指定 skill 的完整内容（SKILL.md），每次只能加载一个',
    schema: z.object({
      name: z.string().describe('要加载的 skill 名称'),
    }),
  }),
  'read',
);

export const runPyTool = withPerm(
  tool(async ({ code }) => runPy(code), {
    name: 'run_py',
    description: '使用 python3 执行一段 Python 代码，返回执行结果或报错信息',
    schema: z.object({
      code: z.string().describe('要执行的 Python 代码'),
    }),
  }),
  'exec',
);

export const memoryCreateTool = withPerm(
  tool(async ({ type, content, keywords, importance }, config) => {
    const sessionId = (config as { configurable?: { thread_id?: string } } | undefined)
      ?.configurable?.thread_id;
    return createMemory({ type, content, keywords, importance, sessionId });
  }, {
    name: 'memory_create',
    description:
      '当用户分享了值得长期记住的信息时存储一条记忆，例如偏好（preference）、事实（fact）、事件（event）、技能（skill）',
    schema: z.object({
      type: z.enum(['fact', 'event', 'preference', 'skill']).describe('记忆类型'),
      content: z.string().describe('自然语言描述的记忆内容，方便拼进 prompt'),
      keywords: z.array(z.string()).optional().describe('用于检索的关键词'),
      importance: z.number().min(1).max(5).optional().describe('重要程度 1~5，默认 3'),
    }),
  }),
  'db',
);

export const memoryRetrieveTool = withPerm(
  tool(async ({ keywords }) => retrieveMemories(keywords), {
    name: 'memory_retrieve',
    description:
      '当用户的问题涉及过去的记忆而当前对话中没有相关信息时，提炼关键词调用此工具检索长期记忆',
    schema: z.object({
      keywords: z.array(z.string()).describe('用于检索记忆的关键词列表'),
    }),
  }),
  'db',
);

export const memoryDeleteTool = withPerm(
  tool(async ({ id }) => deleteMemory(id), {
    name: 'memory_delete',
    description: '当用户想要删除或遗忘某条记忆时，按 id 删除该记忆（id 可通过 memory_retrieve 检索结果获得）',
    schema: z.object({
      id: z.number().describe('要删除的记忆 id'),
    }),
  }),
  'db',
);

export const profileUpdateTool = withPerm(
  tool(async ({ content }) => updateProfile(content), {
    name: 'profile_update',
    description:
      '更新用户画像（profile）。更新时必须保留 <profile_info> 中提到的其他已有信息，所有 profile 信息一起全量更新',
    schema: z.object({
      content: z.string().describe('完整的用户画像内容（全量，不是增量）'),
    }),
  }),
  'write',
);

export const agentTool = withPerm(
  tool(async ({ prompt }) => runSubAgent(prompt), {
    name: 'agent',
    description:
      '启动一个子 agent 独立完成一个独立任务。只传入任务描述（纯文本），子 agent 看不到当前对话记录，执行完后返回最终结果。一次只能启动一个子 agent。',
    schema: z.object({
      prompt: z.string().describe('要交给子 agent 独立完成的任务描述（纯文本）'),
    }),
  }),
  'exec',
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
  agentTool,
];

// —— 工具输出过大时的落盘处理（实现在 tools/persist_output.ts，这里做转发） ————
export { maybePersistedOutput } from './tools/persist_output.js';
