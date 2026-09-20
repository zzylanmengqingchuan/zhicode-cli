#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import * as readline from 'node:readline';
import chalk from 'chalk';
import { modelContextLimit, runAgentStream } from './agent.js';
import { showBanner } from './banner.js';
import { createCommand } from './command.js';
import { handleSlashCommand, type CommandContext } from './commands.js';
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

  try {
    const result = await runAgentStream(
      userInput,
      (token: string) => {
        process.stdout.write(token);
      },
      ctx.getThreadId(),
      controller.signal,
    );
    const max = await modelContextLimit();
    console.log(chalk.gray(`\n${formatContextUsage(result.contextTokens, max)}`));
    if (isContextNearLimit(result.contextTokens, max)) {
      console.log(
        chalk.yellow('⚠️  Context window 接近大模型接口上限，即将压缩 Context，可能会丢失信息'),
      );
      console.log(chalk.yellow('⚠️  建议输入 /new 命令开启新会话'));
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

