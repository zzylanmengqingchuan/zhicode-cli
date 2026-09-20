import { readLocalFile } from './read_file';
import { readFile, tools } from '../tools';

describe('readLocalFile 实现', () => {
  it('能读取当前目录下的文件', async () => {
    const content = await readLocalFile('package.json');
    expect(content).toContain('"name": "zzycli"');
  });

  it('拒绝读取上级目录（路径穿越）', async () => {
    await expect(readLocalFile('../outside.txt')).rejects.toThrow('只允许访问当前目录');
  });

  it('拒绝读取系统绝对路径', async () => {
    await expect(readLocalFile('/etc/hosts')).rejects.toThrow('只允许访问当前目录');
  });

  it('文件不存在时报错', async () => {
    await expect(readLocalFile('no-such-file.txt')).rejects.toThrow();
  });
});

describe('read_file 工具注册', () => {
  it('元信息正确', () => {
    expect(readFile.name).toBe('read_file');
    expect(readFile.description).toContain('读取');
  });

  it('已加入 tools 数组', () => {
    expect(tools).toContain(readFile);
  });
});
