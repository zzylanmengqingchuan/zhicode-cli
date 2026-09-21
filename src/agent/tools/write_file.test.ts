import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { writeLocalFile } from './write_file';
import { writeFile, tools } from '../tools';

const TMP_DIR = path.join(process.cwd(), 'tmp-tool-test');

afterAll(async () => {
  await fs.rm(TMP_DIR, { recursive: true, force: true });
});

describe('writeLocalFile 实现', () => {
  it('能创建新文件并写入内容', async () => {
    const target = 'tmp-tool-test/hello.txt';
    const msg = await writeLocalFile(target, 'hello zzycli');
    expect(msg).toContain('文件已写入');
    expect(await fs.readFile(path.join(process.cwd(), target), 'utf-8')).toBe('hello zzycli');
  });

  it('能重写已有文件', async () => {
    const target = 'tmp-tool-test/overwrite.txt';
    await writeLocalFile(target, '旧内容');
    await writeLocalFile(target, '新内容');
    expect(await fs.readFile(path.join(process.cwd(), target), 'utf-8')).toBe('新内容');
  });

  it('能自动创建不存在的子目录', async () => {
    const target = 'tmp-tool-test/deep/nested/a.txt';
    await writeLocalFile(target, 'nested');
    expect(await fs.readFile(path.join(process.cwd(), target), 'utf-8')).toBe('nested');
  });

  it('支持写入任意目录（绝对路径）', async () => {
    const target = path.join(TMP_DIR, 'abs.txt');
    await writeLocalFile(target, 'absolute');
    expect(await fs.readFile(target, 'utf-8')).toBe('absolute');
  });
});

describe('write_file 工具注册', () => {
  it('元信息正确', () => {
    expect(writeFile.name).toBe('write_file');
    expect(writeFile.description).toContain('创建新文件');
    expect(writeFile.permission_level).toBe('write');
  });

  it('已加入 tools 数组', () => {
    expect(tools).toContain(writeFile);
  });
});
