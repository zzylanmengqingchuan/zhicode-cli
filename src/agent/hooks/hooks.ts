import { exec } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig } from '../config.js';

export interface HookEntry {
  /** 匹配工具名（name 中包含该字符串即命中；非工具类事件用 "*" 或不填匹配全部） */
  matcher: string;
  /** 要执行的 shell 脚本 */
  command: string;
}

export interface HooksConfig {
  hooks: Record<string, HookEntry[]>;
}

export type HookAction =
  | { action: 'continue' }
  | { action: 'block'; error: string }
  | { action: 'inject'; message: string };

const HOOKS_PATH = path.join(__dirname, 'hooks.json');

let cachedConfig: HooksConfig | null = null;

/**
 * 加载 hooks 配置（带缓存；测试可传入自定义路径）：
 * 内置 hooks.json（代码自带的安全默认）+ 用户配置 ~/.zhiwen/zhiwen.json 的 hooks 区，按事件合并
 */
export function loadHooksConfig(configPath: string = HOOKS_PATH): HooksConfig {
  if (configPath === HOOKS_PATH && cachedConfig) return cachedConfig;
  let base: HooksConfig = { hooks: {} };
  try {
    base = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as HooksConfig;
  } catch {
    // 配置文件不存在或格式错误时视为无内置 hooks
  }

  const userHooks = loadConfig()?.hooks ?? {};
  const merged: HooksConfig = { hooks: { ...base.hooks } };
  for (const [event, entries] of Object.entries(userHooks)) {
    merged.hooks[event] = [...(merged.hooks[event] ?? []), ...entries];
  }

  if (configPath === HOOKS_PATH) cachedConfig = merged;
  return merged;
}

/**
 * 按事件 + 工具名匹配 hook 条目
 */
export function matchHooks(
  event: string,
  toolName: string,
  config: HooksConfig = loadHooksConfig(),
): HookEntry[] {
  const entries = config.hooks[event] ?? [];
  return entries.filter(
    (e) => !e.matcher || e.matcher === '*' || toolName.includes(e.matcher),
  );
}

interface HookRunResult {
  code: number;
  stderr: string;
}

function runCommand(command: string, env: Record<string, string>): Promise<HookRunResult> {
  return new Promise((resolve) => {
    exec(
      command,
      { cwd: process.cwd(), timeout: 10000, env: { ...process.env, ...env } },
      (err, _stdout, stderr) => {
        const code = err ? (typeof err.code === 'number' ? err.code : 1) : 0;
        resolve({ code, stderr: (stderr ?? '').trim() });
      },
    );
  });
}

/**
 * 执行某事件下匹配的所有 hook 脚本，按顺序执行：
 * - exit 0 → 继续
 * - exit 1 → 阻止（block），stderr 作为错误信息
 * - exit 2 → 继续，但 stderr 注入对话（inject）
 *
 * 通过环境变量向脚本传递上下文：HOOK_EVENT / TOOL_NAME / TOOL_ARGS
 */
export async function runHooks(
  event: string,
  toolName: string,
  extraEnv: Record<string, string> = {},
  config: HooksConfig = loadHooksConfig(),
): Promise<HookAction> {
  const matched = matchHooks(event, toolName, config);
  const injectMessages: string[] = [];

  for (const hook of matched) {
    const { code, stderr } = await runCommand(hook.command, {
      HOOK_EVENT: event,
      TOOL_NAME: toolName,
      ...extraEnv,
    });
    if (code === 1) {
      return { action: 'block', error: stderr || `hook 阻止了本次操作: ${hook.command}` };
    }
    if (code === 2 && stderr) {
      injectMessages.push(stderr);
    }
  }

  if (injectMessages.length > 0) {
    return { action: 'inject', message: injectMessages.join('\n') };
  }
  return { action: 'continue' };
}
