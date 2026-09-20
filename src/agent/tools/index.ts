import { tool } from 'langchain';
import { z } from 'zod';
import { searchWeb } from './search.js';
import { readLocalFile } from './read_file.js';
import { writeLocalFile } from './write_file.js';
import { execCommand } from './exec.js';
import { runJs } from './run_js.js';
import { webSearch } from './web_search.js';
import { webFetch } from './web_fetch.js';

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

export const tools = [search, readFile, writeFile, execTool, runJsTool, webSearchTool, webFetchTool];
