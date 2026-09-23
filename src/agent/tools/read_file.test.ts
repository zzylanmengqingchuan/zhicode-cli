import { readLocalFile } from './read_file';
import { readFile, tools } from '../tools';

describe('readLocalFile 实现', () => {
  it('能读取项目内的文件（相对路径）', async () => {
    const content = await readLocalFile('package.json');
    expect(content).toContain('"name": "zhiwen"');
  });

  it('能读取任意目录的文件（绝对路径）', async () => {
    const content = await readLocalFile('/etc/hosts');
    expect(content.length).toBeGreaterThan(0);
  });

  it('文件不存在时报错', async () => {
    await expect(readLocalFile('no-such-file.txt')).rejects.toThrow();
  });
});

describe('read_file 工具注册', () => {
  it('元信息正确', () => {
    expect(readFile.name).toBe('read_file');
    expect(readFile.description).toContain('读取');
    expect(readFile.permission_level).toBe('read');
  });

  it('已加入 tools 数组', () => {
    expect(tools).toContain(readFile);
  });
});
