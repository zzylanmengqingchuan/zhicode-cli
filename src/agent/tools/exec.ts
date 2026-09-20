import { exec } from 'node:child_process';

/**
 * 危险命令黑名单：删除/移动/格式化/提权/杀进程/关机，以及跳出当前目录
 */
const FORBIDDEN: RegExp[] = [
  /\brm\b/,
  /\brmdir\b/,
  /\bmv\b/,
  /\bdd\b/,
  /\bmkfs\b/,
  /\bshutdown\b/,
  /\breboot\b/,
  /\bsudo\b/,
  /\bkill\b/,
  /\bpkill\b/,
  /\bchmod\b/,
  /\bchown\b/,
  /cd\s+(\.\.|\/|~)/,
  />\s*\//,
];

const MAX_OUTPUT = 2000;

/**
 * exec 工具的具体实现（纯函数，方便单元测试）
 * 在当前目录下执行 shell 命令；危险命令直接拒绝；默认 10s 超时
 */
export async function execCommand(command: string, timeoutMs = 10000): Promise<string> {
  for (const pattern of FORBIDDEN) {
    if (pattern.test(command)) {
      throw new Error(`禁止执行危险命令: ${command}`);
    }
  }

  return new Promise((resolve, reject) => {
    exec(
      command,
      { cwd: process.cwd(), timeout: timeoutMs, maxBuffer: 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`命令执行失败: ${err.message}\n${stderr}`.trim()));
          return;
        }
        const output = (stdout + stderr).trim() || '(无输出)';
        resolve(output.length > MAX_OUTPUT ? `${output.slice(0, MAX_OUTPUT)}\n...(输出已截断)` : output);
      },
    );
  });
}
