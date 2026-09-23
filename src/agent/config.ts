import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/** 用户级目录：~/.zhiwen（os.homedir() 兼容 Win/Mac/Linux） */
export const ZHIWEN_DIR = path.join(os.homedir(), '.zhiwen');

/** 用户数据目录：~/.zhiwen/.data（数据库、profile 等） */
export const DATA_DIR = path.join(ZHIWEN_DIR, '.data');

/** 用户级配置文件：~/.zhiwen/zhiwen.json */
export const CONFIG_PATH = path.join(ZHIWEN_DIR, 'zhiwen.json');

export interface McpServerEntry {
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  permission_level?: string;
}

export interface ZhiwenConfig {
  model?: {
    model?: string;
    apiKey?: string;
    baseURL?: string;
  };
  /** 环境变量区：TAVILY_API_KEY 等 */
  env?: Record<string, string>;
  /** hooks 配置区：与内置 hooks.json 同格式，启动时合并（用户配置追加在内置之后） */
  hooks?: Record<string, { matcher: string; command: string }[]>;
  /** MCP server 配置区：与 mcp.json 同格式，启动时合并（同名 server 以用户配置为准） */
  mcpServers?: Record<string, McpServerEntry>;
}

/**
 * 读取并解析 ~/.zhiwen/zhiwen.json；文件不存在或格式错误返回 null（由调用方决定如何报错）
 */
export function loadConfig(configPath: string = CONFIG_PATH): ZhiwenConfig | null {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as ZhiwenConfig;
  } catch {
    return null;
  }
}

/**
 * 读取 env 区的配置值；配置文件没有时回退到进程环境变量
 */
export function getEnvValue(name: string, configPath: string = CONFIG_PATH): string | undefined {
  return loadConfig(configPath)?.env?.[name] ?? process.env[name];
}

/**
 * 读取 mcpServers 配置区；用户没有配置时返回空对象
 */
export function getMcpServerConfig(configPath: string = CONFIG_PATH): Record<string, McpServerEntry> {
  return loadConfig(configPath)?.mcpServers ?? {};
}
