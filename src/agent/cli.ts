#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import * as readline from 'node:readline';
import { runAgentStream } from './agent.js';
import { showBanner } from './banner.js';
import { createCommand } from './command.js';

// 每次启动生成新的会话 ID；历史记录由 agent.ts 的 checkpointer 按此 ID 持久化
const THREAD_ID = `session-${randomUUID()}`;

async function chat(rl: readline.Interface, userInput: string): Promise<void> {
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
    await runAgentStream(
      userInput,
      (token: string) => {
        process.stdout.write(token);
      },
      THREAD_ID,
      controller.signal,
    );
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

  showBanner();

  rl.setPrompt('你: ');
  rl.prompt();

  for await (const line of rl) {
    const userInput = line.trim();

    if (userInput === 'exit' || userInput === 'quit') break;

    if (userInput) {
      try {
        await chat(rl, userInput);
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
