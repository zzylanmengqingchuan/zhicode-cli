#!/usr/bin/env node
import chalk from 'chalk';
import { runInstallIfFirstRun } from './install.js';

async function main(): Promise<void> {
  // 首次运行：初始化配置后退出，提示用户先填写模型配置。
  // 注意：cli/agent 的模块加载依赖已存在的模型配置，必须在安装检查之后再加载
  await runInstallIfFirstRun();

  // 启动前验证模型配置与 API Key 可用性，有问题尽早拦截
  const { checkModel } = require('./agent/model.js') as typeof import('./agent/model.js');
  await checkModel();

  // 入口：组装命令并启动
  const { startChat } = require('./agent/cli.js') as typeof import('./agent/cli.js');
  const { createCommand } = require('./agent/command.js') as typeof import('./agent/command.js');
  const program = createCommand(startChat);
  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error(chalk.red(`\n启动失败: ${err instanceof Error ? err.message : String(err)}\n`));
  process.exit(1);
});
