#!/usr/bin/env node
import { startChat } from './agent/cli.js';
import { createCommand } from './agent/command.js';

// 入口：组装命令并启动
const program = createCommand(startChat);
program.parseAsync(process.argv);
