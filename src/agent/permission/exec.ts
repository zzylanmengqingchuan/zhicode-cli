import { normalizePath } from './is-dangerous-path.js';
import { isInProjectDir } from './util.js';

export interface ExecPermissionResult {
  action: 'allow' | 'confirm' | 'block';
  reason?: string;
}

/** exec 中禁止直译执行的语言解释器 → 提示语 */
const FORBIDDEN_INTERPRETERS: { pattern: RegExp; hint: string }[] = [
  {
    pattern: /python3?/i,
    hint: '请改用 run_py 工具执行 Python 代码',
  },
  {
    pattern: /node|tsx|ts-node|deno|bun/i,
    hint: '请改用 run_js 工具执行 JS/TS 代码',
  },
  {
    pattern: /java|javac|go|ruby|cargo|rustc|dotnet|php|perl|rscript|scala|groovy/i,
    hint: 'exec 工具只允许执行 shell/bash/sh 命令',
  },
];

/** 危险操作黑名单（按可执行词匹配，覆盖 macOS / Linux / Windows 命令名） */
const FORBIDDEN_COMMANDS: { pattern: RegExp; reason: string }[] = [
  { pattern: /^(sudo|doas|runas)$/i, reason: '禁止 sudo 等超级权限操作' },
  {
    pattern: /^(rm|rmdir|del|erase|rd|remove-item|unlink|shred)$/i,
    reason: '禁止删除文件或目录',
  },
  {
    pattern: /^(mv|move|rename|ren|dd|truncate)$/i,
    reason: '禁止移动或修改文件/目录',
  },
  {
    pattern: /^(chmod|chown|chgrp|icacls|attrib)$/i,
    reason: '禁止修改文件权限或属性',
  },
  {
    pattern: /^(kill|pkill|killall|taskkill|systemctl|service|launchctl|sc|shutdown|reboot|halt|poweroff)$/i,
    reason: '禁止控制进程或服务',
  },
  {
    pattern: /^(useradd|usermod|userdel|passwd|chsh|dscl)$/i,
    reason: '禁止修改用户信息',
  },
  {
    pattern: /^(security|vault|secret-tool)$/i,
    reason: '禁止获取敏感信息',
  },
  {
    pattern: /^(ssh|scp|sftp|telnet|nc|ncat|rsync|ssh-keygen)$/i,
    reason: '禁止网络和远程控制操作',
  },
  {
    pattern: /^(curl|wget)$/i,
    reason: '禁止直接发起网络请求，请改用 web_fetch 或 web_search 工具',
  },
];

/** 命令文本中出现即视为获取敏感信息的路径片段 */
const SENSITIVE_CONTENT = /\/etc\/(shadow|gshadow|sudoers)|id_rsa|id_ed25519|\.ssh[\\/]/;

/**
 * 把命令按 &&、;、||、| 拆成命令段，每段再拆成词
 */
function commandSegments(command: string): string[][] {
  return command
    .split(/&&|\|\||[;|]/)
    .map((seg) => seg.trim().split(/\s+/).filter(Boolean))
    .filter((seg) => seg.length > 0);
}

/** 只读安全命令白名单（linux / macOS / Windows 命令名） */
const SAFE_BINS = new Set([
  'ls',
  'dir',
  'pwd',
  'cat',
  'type',
  'head',
  'tail',
  'grep',
  'findstr',
  'find',
  'echo',
  'date',
  'whoami',
  'hostname',
  'ver',
]);

/** git 只放行的只读子命令 */
const SAFE_GIT_SUBCOMMANDS = new Set(['status', 'diff', 'log']);

/**
 * 判断整条命令是否只由安全命令组成（每个命令段都必须命中白名单）。
 * 命中则无需用户确认，直接执行。
 */
export function isSafeCommand(command: string): boolean {
  const segments = commandSegments(command);
  if (segments.length === 0) return false;
  return segments.every((seg) => {
    const bin = (seg[0].split('/').pop() ?? seg[0]).toLowerCase();
    if (bin === 'git') {
      return seg.length > 1 && SAFE_GIT_SUBCOMMANDS.has(seg[1].toLowerCase());
    }
    return SAFE_BINS.has(bin);
  });
}

/**
 * 提取命令中每个命令段的首个可执行词（以 &&、;、||、| 分隔）
 */
function commandBins(command: string): string[] {
  const bins: string[] = [];
  const re = /(?:^|&&|\|\||[;|])\s*([a-zA-Z0-9_.+/-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(command)) !== null) {
    // /bin/rm → rm
    bins.push(match[1].split('/').pop() ?? match[1]);
  }
  return bins;
}

/**
 * 检测命令中是否调用了其他语言的解释器（如 python3 -c、node script.js）。
 * shell / bash / sh 是允许的。返回命中信息，未命中返回 null。
 */
export function findForbiddenInterpreter(command: string): string | null {
  for (const bin of commandBins(command)) {
    if (/^(ba|z|fi)?sh$/.test(bin)) continue; // shell 系放行
    for (const { pattern, hint } of FORBIDDEN_INTERPRETERS) {
      if (pattern.test(bin)) return hint;
    }
  }
  return null;
}

/**
 * 检测命令中的危险操作（sudo / 删除 / 修改 / 权限 / 进程服务 / 用户 / 敏感信息 / 远程控制）。
 * 返回命中的原因，未命中返回 null。
 */
export function findDangerousCommand(command: string): string | null {
  for (const bin of commandBins(command)) {
    for (const { pattern, reason } of FORBIDDEN_COMMANDS) {
      if (pattern.test(bin)) return reason;
    }
  }
  if (SENSITIVE_CONTENT.test(command)) return '禁止获取敏感信息';
  return null;
}

/**
 * 判断 shell 命令是否会跳出当前目录。
 * 解析命令中的 cd / pushd（支持 &&、;、||、| 分隔的复合命令），
 * 目标目录在项目目录外（含 `cd`、`cd ..`、`cd ~`、`cd /abs`）视为跳出。
 */
export function commandEscapesCwd(command: string): boolean {
  const re = /(?:^|&&|\|\||[;|])\s*(?:cd|pushd)\s*([^;&|]*)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(command)) !== null) {
    const target = match[1].trim().replace(/^['"]|['"]$/g, '');
    // 无参数（回到家目录）或 cd -（回到上次目录）都算跳出
    if (target === '' || target === '-') return true;
    if (!isInProjectDir(normalizePath(target))) return true;
  }
  return false;
}

/**
 * exec 级别工具的权限判定：
 * - 命令中调用其他语言解释器（python/node/java/go 等）→ 直接阻止并提示改用对应工具
 * - 命令会跳出当前目录 → 直接阻止
 * - 否则询问用户确认后执行
 */
export function evaluateExecPermission(args: unknown): ExecPermissionResult {
  const command = (args as { command?: string } | null | undefined)?.command;
  // 获取不到 command 参数时，继续走确认逻辑
  if (!command) return { action: 'confirm' };

  const langHint = findForbiddenInterpreter(command);
  if (langHint) {
    return {
      action: 'block',
      reason: `操作已被安全策略阻止：exec 工具不允许直接执行该语言的脚本。${langHint}。`,
    };
  }

  const dangerReason = findDangerousCommand(command);
  if (dangerReason) {
    return {
      action: 'block',
      reason: `操作已被安全策略阻止：${dangerReason}。`,
    };
  }

  if (commandEscapesCwd(command)) {
    return {
      action: 'block',
      reason: '操作已被安全策略阻止：命令会切换到项目目录之外执行，不允许。请在项目目录内操作。',
    };
  }

  // 全部是只读安全命令 → 直接执行，无需确认
  if (isSafeCommand(command)) {
    return { action: 'allow' };
  }
  return { action: 'confirm' };
}
