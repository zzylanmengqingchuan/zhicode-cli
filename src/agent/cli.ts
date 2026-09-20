#!/usr/bin/env node
import * as readline from 'node:readline';
import { runAgentStream } from './agent.js';
import { createCommand } from './command.js';

// 历史记录由 agent.ts 的 checkpointer 自动持久化，这里只需固定 thread_id
const THREAD_ID = 'user-session-1';

async function chat(rl: readline.Interface, userInput: string): Promise<void> {
  const isTTY = process.stdin.isTTY;
  if (isTTY) rl.pause(); // 交互终端下暂停 readline，避免光标错位（管道输入时不能暂停，否则会丢行）

  process.stdout.write('\nAI: ');

  await runAgentStream(
    userInput,
    (token: string) => {
      process.stdout.write(token);
    },
    THREAD_ID,
  );

  process.stdout.write('\n\n');
  if (isTTY) rl.resume(); // 恢复 readline
}

export async function startChat(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('ReAct Agent 已启动，输入 exit 退出\n');

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
