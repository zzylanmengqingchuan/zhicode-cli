import { runJs } from './run_js';
import { runJsTool, tools } from './index';

describe('runJs 实现', () => {
  it('能执行 JS 代码并返回输出', async () => {
    expect(await runJs('console.log(1 + 1)')).toBe('2');
  });

  it('能执行数组操作', async () => {
    expect(await runJs('console.log([1,2,3].map(x => x * 2).join(","))')).toBe('2,4,6');
  });

  it('在当前目录下执行', async () => {
    expect(await runJs('console.log(process.cwd())')).toBe(process.cwd());
  });

  it('语法错误时返回报错信息', async () => {
    expect(await runJs('console.log(')).toContain('执行失败');
  });

  it('运行时错误时返回报错信息', async () => {
    expect(await runJs('null.x')).toContain('执行失败');
  });

  it('代码超时时返回报错信息', async () => {
    expect(await runJs('while(true){}', 500)).toContain('执行失败');
  });

  it('本地未安装 Node.js 时给出提示', async () => {
    expect(await runJs('console.log(1)', 10000, 'no-such-node-bin-xyz')).toContain(
      '未安装 Node.js',
    );
  });
});

describe('run_js 工具注册', () => {
  it('元信息正确', () => {
    expect(runJsTool.name).toBe('run_js');
    expect(runJsTool.description).toContain('Node.js');
  });

  it('已加入 tools 数组', () => {
    expect(tools).toContain(runJsTool);
  });
});
