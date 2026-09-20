import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const MAX_OUTPUT = 2000;

function truncate(text: string): string {
  return text.length > MAX_OUTPUT ? `${text.slice(0, MAX_OUTPUT)}\n...(输出已截断)` : text;
}

/**
 * run_py 工具的具体实现（纯函数，方便单元测试）
 * 使用 python3 执行 Python 代码；执行结果或报错信息都以字符串返回给 AI。
 * pyBin 参数用于注入 python 可执行文件名（测试可传入不存在的名字模拟未安装场景）。
 */
export async function runPy(
  code: string,
  timeoutMs = 10000,
  pyBin = 'python3',
): Promise<string> {
  // 先检查本地是否安装了 python3，未安装则明确提示
  try {
    await execFileAsync(pyBin, ['--version']);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return `当前环境未安装 Python3（未找到命令 ${pyBin}），无法执行 Python 代码。请先安装 Python: https://www.python.org`;
    }
    throw err;
  }

  try {
    const { stdout, stderr } = await execFileAsync(pyBin, ['-c', code], {
      cwd: process.cwd(),
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
    });
    const output = (stdout + stderr).trim();
    return output ? truncate(output) : '(无输出)';
  } catch (err) {
    const e = err as Error & { stderr?: string };
    const detail = [e.message, e.stderr].filter(Boolean).join('\n');
    return `执行失败: ${detail}`;
  }
}
