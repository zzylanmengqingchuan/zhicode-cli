import { randomUUID } from 'node:crypto';
import Table from 'cli-table3';
import { formatRelativeTime, listSessions, sessionExists } from './sessions.js';

/**
 * 斜杠命令的上下文：命令可以通过它读取/修改当前会话状态
 */
export interface CommandContext {
  getThreadId(): string;
  setThreadId(id: string): void;
}

export interface SlashCommand {
  name: string;
  usage: string;
  description: string;
  run(args: string, ctx: CommandContext): void | Promise<void>;
}

const commands = new Map<string, SlashCommand>();

/**
 * 注册新命令。未来扩展 /sessions、/rewind、/skill 等只需调用此函数
 */
export function registerCommand(cmd: SlashCommand): void {
  commands.set(cmd.name, cmd);
}

/**
 * 处理用户输入：是斜杠命令则执行并返回 true，否则返回 false（走正常 AI 对话）
 */
export async function handleSlashCommand(
  input: string,
  ctx: CommandContext,
): Promise<boolean> {
  if (!input.startsWith('/')) return false;

  const [rawName, ...rest] = input.slice(1).trim().split(/\s+/);
  const cmd = commands.get(rawName);
  if (!cmd) {
    console.log(`未知命令: /${rawName}。可用命令:`);
    for (const c of commands.values()) {
      console.log(`  ${c.usage}  ${c.description}`);
    }
    return true;
  }

  await cmd.run(rest.join(' '), ctx);
  return true;
}

// —— 内置命令 ————————————————————————————————————————————————

registerCommand({
  name: 'new',
  usage: '/new',
  description: '开启一个新会话（之后的对话不再携带当前上下文）',
  run: (_args, ctx) => {
    ctx.setThreadId(`session-${randomUUID()}`);
    console.log(`已开启新会话: ${ctx.getThreadId()}`);
  },
});

registerCommand({
  name: 'sessions',
  usage: '/sessions',
  description: '列出最近 20 条会话记录（按时间逆序）',
  run: () => {
    const sessions = listSessions(20);
    if (sessions.length === 0) {
      console.log('暂无历史会话');
      return;
    }
    const table = new Table({
      head: ['thread_id', '最后用户输入的问题', '时间'],
    });
    for (const s of sessions) {
      table.push([s.threadId, s.lastQuestion, formatRelativeTime(s.lastActiveAt)]);
    }
    console.log(table.toString());
  },
});

registerCommand({
  name: 'rewind',
  usage: '/rewind <thread_id>',
  description: '恢复到指定的历史会话，继续聊天',
  run: (args, ctx) => {
    const threadId = args.trim();
    if (!threadId) {
      console.log('用法: /rewind <thread_id>（thread_id 可通过 /sessions 查看）');
      return;
    }
    if (!sessionExists(threadId)) {
      console.log(`会话不存在: ${threadId}（可通过 /sessions 查看所有会话）`);
      return;
    }
    ctx.setThreadId(threadId);
    console.log(`已恢复到会话: ${threadId}`);
  },
});
