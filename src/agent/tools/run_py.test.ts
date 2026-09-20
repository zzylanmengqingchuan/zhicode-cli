import { runPy } from './run_py';
import { runPyTool, tools } from '../tools';

describe('runPy 实现', () => {
  it('能执行 Python 代码并返回输出', async () => {
    expect(await runPy('print(1 + 1)')).toBe('2');
  });

  it('能执行列表推导式', async () => {
    expect(await runPy('print([x * 2 for x in [1, 2, 3]])')).toBe('[2, 4, 6]');
  });

  it('在当前目录下执行', async () => {
    expect(await runPy('import os; print(os.getcwd())')).toBe(process.cwd());
  });

  it('语法错误时返回报错信息', async () => {
    expect(await runPy('print(')).toContain('执行失败');
  });

  it('运行时错误时返回报错信息', async () => {
    expect(await runPy('1 / 0')).toContain('执行失败');
    expect(await runPy('1 / 0')).toContain('ZeroDivisionError');
  });

  it('代码超时时返回报错信息', async () => {
    expect(await runPy('import time; time.sleep(5)', 500)).toContain('执行失败');
  });

  it('本地未安装 python3 时给出提示', async () => {
    expect(await runPy('print(1)', 10000, 'no-such-python-bin-xyz')).toContain(
      '未安装 Python3',
    );
  });
});

describe('run_py 工具注册', () => {
  it('元信息正确', () => {
    expect(runPyTool.name).toBe('run_py');
    expect(runPyTool.description).toContain('Python');
  });

  it('已加入 tools 数组', () => {
    expect(tools).toContain(runPyTool);
  });
});
