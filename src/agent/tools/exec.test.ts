import { execCommand } from './exec';
import { execTool, tools } from './index';

describe('execCommand 实现', () => {
  it('能执行普通命令并返回输出', async () => {
    expect(await execCommand('echo hello')).toBe('hello');
  });

  it('在当前目录下执行（pwd 为项目根目录）', async () => {
    expect(await execCommand('pwd')).toBe(process.cwd());
  });

  it('能列出 src 目录', async () => {
    expect(await execCommand('ls src')).toContain('agent');
  });

  it('拒绝 rm 删除命令', async () => {
    await expect(execCommand('rm -rf tmp')).rejects.toThrow('禁止执行危险命令');
  });

  it('拒绝 rmdir / mv / dd', async () => {
    await expect(execCommand('rmdir tmp')).rejects.toThrow('禁止执行危险命令');
    await expect(execCommand('mv a b')).rejects.toThrow('禁止执行危险命令');
    await expect(execCommand('dd if=/dev/zero of=x')).rejects.toThrow('禁止执行危险命令');
  });

  it('拒绝 sudo 提权', async () => {
    await expect(execCommand('sudo ls')).rejects.toThrow('禁止执行危险命令');
  });

  it('拒绝跳出当前目录', async () => {
    await expect(execCommand('cd .. && ls')).rejects.toThrow('禁止执行危险命令');
    await expect(execCommand('cd / && ls')).rejects.toThrow('禁止执行危险命令');
  });

  it('命令超时会报错', async () => {
    await expect(execCommand('sleep 5', 500)).rejects.toThrow('命令执行失败');
  });

  it('命令本身失败时报错并带 stderr', async () => {
    await expect(execCommand('ls no-such-dir-xyz')).rejects.toThrow('命令执行失败');
  });
});

describe('exec 工具注册', () => {
  it('元信息正确', () => {
    expect(execTool.name).toBe('exec');
    expect(execTool.description).toContain('shell');
  });

  it('已加入 tools 数组', () => {
    expect(tools).toContain(execTool);
  });
});
