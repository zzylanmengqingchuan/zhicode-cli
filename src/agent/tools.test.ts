import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { maybePersistedOutput } from './tools';

const OUTPUT_DIR = path.join(process.cwd(), 'tool_output');

afterAll(async () => {
  await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
});

describe('maybePersistedOutput', () => {
  it('内容不超过 50000 字符时原样返回', async () => {
    const short = 'x'.repeat(50000);
    expect(await maybePersistedOutput(short, 'call-1')).toBe(short);
  });

  it('内容超过 50000 字符时写入文件并返回摘要', async () => {
    const big = 'abc'.repeat(20000); // 60000 字符
    const result = await maybePersistedOutput(big, 'call-big');

    expect(result).toContain('<persisted-output>');
    expect(result).toContain('Output too large (58.6KB)');
    expect(result).toContain('tool_output_call-big.txt');
    expect(result).toContain(big.slice(0, 2000));
    expect(result.length).toBeLessThan(3000);

    // 完整内容真的落盘了
    const saved = await fs.readFile(
      path.join(OUTPUT_DIR, 'tool_output_call-big.txt'),
      'utf-8',
    );
    expect(saved).toBe(big);
  });
});
