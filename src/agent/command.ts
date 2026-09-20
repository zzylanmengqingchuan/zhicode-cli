import * as fs from 'node:fs';
import * as path from 'node:path';
import { Command } from 'commander';

export interface Pkg {
  name: string;
  version: string;
  description: string;
  author: string;
  docs: string;
}

export function loadPkg(): Pkg {
  // tsx 运行时 __dirname 是 src/agent，编译后是 dist/src/agent，两种深度都试一下
  const candidates = [
    path.resolve(__dirname, '../../package.json'),
    path.resolve(__dirname, '../../../package.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8')) as Pkg;
    }
  }
  return { name: 'zzycli', version: '0.0.0', description: '', author: '', docs: '' };
}

export function createCommand(startChat: () => Promise<void>): Command {
  const pkg = loadPkg();

  const program = new Command();

  program
    .name('zzycli')
    .description(pkg.description || 'AI 命令行聊天工具，基于 Kimi 大模型')
    .version(pkg.version, '-v, --version', '显示版本号')
    .action(async () => {
      await startChat();
    });

  return program;
}
