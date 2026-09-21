#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import * as readline from 'node:readline';
import chalk from 'chalk';
import {
  compressContext,
  modelContextLimit,
  runAgentStream,
  type ToolConfirmRequest,
} from './agent.js';
import { showBanner } from './banner.js';
import { createCommand } from './command.js';
import { handleSlashCommand, type CommandContext } from './commands.js';
import { KEEP_RECENT_MESSAGES } from './context.js';
import { formatContextUsage, isContextNearLimit } from './context-stats.js';

// 每次启动生成新的会话 ID；历史记录由 agent.ts 的 checkpointer 按此 ID 持久化
// 斜杠命令（如 /new）可通过 CommandContext 切换会话
function createContext(): CommandContext {
  let threadId = `session-${randomUUID()}`;
  return {
    getThreadId: () => threadId,
    setThreadId: (id: string) => {
      threadId = id;
    },
  };
}

async function chat(
  rl: readline.Interface,
  ctx: CommandContext,
  userInput: string,
): Promise<void> {
  const isTTY = process.stdin.isTTY;
  const controller = new AbortController();

  const onKeypress = (_str: string, key: readline.Key) => {
    if (key && key.name === 'escape') {
      controller.abort();
    }
  };

  if (isTTY) {
    // 注意：不能 rl.pause()，它会暂停 stdin 导致 keypress 事件收不到。
    // 保持 readline 运行，流式期间输入的字符会被缓冲为下一行（type-ahead）。
    readline.emitKeypressEvents(process.stdin);
    process.stdin.on('keypress', onKeypress);
    process.stdout.write('\nAI: (按 ESC 取消) ');
  } else {
    process.stdout.write('\nAI: ');
  }

  // 工具调用确认（human-in-the-loop）：仅交互终端需要按键确认，管道/脚本场景自动允许
  const confirm = isTTY
    ? (request: ToolConfirmRequest): Promise<boolean> =>
        new Promise((resolve) => {
          const argsText = JSON.stringify(request.args)?.slice(0, 200) ?? '';
          process.stdout.write(
            chalk.yellow(`\n⚠️  AI 请求调用工具 ${request.name}，参数: ${argsText}\n允许执行吗？[y/n] `),
          );
          const handler = (_str: string, key: readline.Key) => {
            if (key && (key.name === 'y' || key.name === 'n')) {
              process.stdin.off('keypress', handler);
              // 清掉按键残留在 readline 行缓冲区里的字符
              (rl as unknown as { line: string; cursor: number }).line = '';
              (rl as unknown as { cursor: number }).cursor = 0;
              process.stdout.write(key.name === 'y' ? 'y ✓\n' : 'n ✗\n');
              resolve(key.name === 'y');
            }
          };
          process.stdin.on('keypress', handler);
        })
    : undefined;

  try {
    const result = await runAgentStream(
      userInput,
      (token: string) => {
        process.stdout.write(token);
      },
      ctx.getThreadId(),
      controller.signal,
      confirm,
    );
    const max = await modelContextLimit();
    console.log(chalk.gray(`\n${formatContextUsage(result.contextTokens, max)}`));
    if (isContextNearLimit(result.contextTokens, max)) {
      console.log(
        chalk.yellow('⚠️  Context 已达到 80%，正在压缩上下文（可能丢失部分细节）...'),
      );
      const outcome = await compressContext(ctx.getThreadId());
      if (outcome) {
        console.log(
          chalk.green(
            `✅ 已将 ${outcome.compressedMessages} 条历史消息压缩为摘要（第 ${outcome.compressionCount} 次压缩），最近 ${KEEP_RECENT_MESSAGES} 条消息保持原样`,
          ),
        );
        if (outcome.compressionCount >= 3) {
          console.log(
            chalk.red('⚠️  已累计压缩 3 次以上，信息损失风险较高，强烈建议输入 /new 开启新会话'),
          );
        }
      } else {
        console.log(chalk.yellow('暂无可压缩的历史消息（最近几条消息会保留不压缩）'));
      }
    }
  } catch (err) {
    if (!controller.signal.aborted) throw err;
    process.stdout.write('\n[已取消本次回复]');
  } finally {
    if (isTTY) {
      process.stdin.off('keypress', onKeypress);
    }
  }

  process.stdout.write('\n\n');
}

export async function startChat(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const ctx = createContext();

  showBanner();

  rl.setPrompt('你: ');
  rl.prompt();

  for await (const line of rl) {
    const userInput = line.trim();

    if (userInput === 'exit' || userInput === 'quit') break;

    if (await handleSlashCommand(userInput, ctx)) {
      rl.prompt();
      continue;
    }

    if (userInput) {
      try {
        await chat(rl, ctx, userInput);
      } catch (err) {
        console.error(`\n[出错] ${err instanceof Error ? err.message : String(err)}\n`);
      }
    }

    rl.prompt();
  }

  rl.close();
}

const program = createCommand(startChat);
program.parseAsync(process.argv);

