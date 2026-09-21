import { exec } from 'node:child_process';

const MAX_OUTPUT = 2000;

/**
 * exec 工具的具体实现（纯函数，方便单元测试）
 * 在当前目录下执行 shell 命令；安全性由 agent 层的用户确认机制把关
 */
export async function execCommand(command: string, timeoutMs = 10000): Promise<string> {
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
