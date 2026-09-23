import * as fs from 'node:fs';
import * as path from 'node:path';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import type { GraphTool } from '../graph.js';
import type { PermissionLevel } from '../tools.js';

interface McpServerConfig {
  command?: string;
  args?: string[];
  url?: string;
  /** url 形式的 server 的请求头（鉴权用），值里的 ${VAR} 会从环境变量展开 */
  headers?: Record<string, string>;
  /** 该 server 下所有工具的权限级别；不配则默认 confirm（用户确认） */
  permission_level?: PermissionLevel;
}

interface McpConfig {
  mcpServers?: Record<string, McpServerConfig>;
}

const MCP_CONFIG_PATH = path.resolve(process.cwd(), 'mcp.json');

const activeClients: MultiServerMCPClient[] = [];

/** 展开配置值中的 ${VAR} 环境变量（如 Authorization: Bearer ${GITHUB_TOKEN}） */
export function expandEnvVars(value: string): string {
  return value.replace(/\$\{(\w+)\}/g, (_, name: string) => process.env[name] ?? '');
}

function expandHeaders(headers?: Record<string, string>): Record<string, string> | undefined {
  if (!headers) return undefined;
  return Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k, expandEnvVars(v)]),
  );
}

export function loadMcpConfig(configPath: string = MCP_CONFIG_PATH): McpConfig {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as McpConfig;
  } catch {
    return {};
  }
}

/**
 * 连接 mcp.json 中配置的所有 MCP server，收集它们提供的工具。
 * 每个 server 独立连接，单个失败只警告并跳过，不阻塞启动。
 */
export async function loadMcpTools(configPath: string = MCP_CONFIG_PATH): Promise<GraphTool[]> {
  const config = loadMcpConfig(configPath);
  const servers = config.mcpServers ?? {};
  const allTools: GraphTool[] = [];

  for (const [name, server] of Object.entries(servers)) {
    // url 形式的 server 网络可能不稳定，失败时重试一次
    const maxAttempts = server.url ? 2 : 1;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const client = new MultiServerMCPClient({
          mcpServers: {
            [name]: server.url
              ? {
                  url: server.url,
                  transport: 'http',
                  ...(expandHeaders(server.headers)
                    ? { headers: expandHeaders(server.headers)! }
                    : {}),
                }
              : { command: server.command!, args: server.args ?? [], transport: 'stdio' },
          },
        });
        const serverTools = (await client.getTools()) as unknown as GraphTool[];
        for (const t of serverTools) {
          // 加 mcp__server__tool 前缀，避免与本地工具重名
          Object.assign(t, {
            name: `mcp__${name}__${t.name}`,
            ...(server.permission_level ? { permission_level: server.permission_level } : {}),
          });
        }
        activeClients.push(client);
        allTools.push(...serverTools);
        console.log(`[MCP] server "${name}" 已连接，提供 ${serverTools.length} 个工具`);
        break;
      } catch (err) {
        if (attempt < maxAttempts) {
          console.warn(`[MCP] server "${name}" 连接失败，重试中...`);
          continue;
        }
        console.warn(
          `[MCP] server "${name}" 连接失败，已跳过: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  return allTools;
}

/**
 * 关闭所有 MCP server 连接（stdio 子进程），进程退出前必须调用
 */
export async function closeMcp(): Promise<void> {
  await Promise.allSettled(activeClients.map((c) => c.close()));
  activeClients.length = 0;
}
