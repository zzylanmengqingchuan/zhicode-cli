import { handleSlashCommand, registerCommand, type CommandContext } from './commands';
import { initAgent } from './agent';

beforeAll(async () => {
  await initAgent({ loadMcp: false }); // 测试不拉起 MCP 子进程
});

function makeCtx(): CommandContext & { id: string } {
  const state = { id: 'session-test-1' };
  return {
    id: state.id,
    getThreadId: () => state.id,
    setThreadId: (id: string) => {
      state.id = id;
    },
  };
}

describe('斜杠命令', () => {
  it('普通输入不拦截', async () => {
    expect(await handleSlashCommand('你好', makeCtx())).toBe(false);
  });

  it('/new 开启新会话（threadId 改变）', async () => {
    const ctx = makeCtx();
    const before = ctx.getThreadId();
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    expect(await handleSlashCommand('/new', ctx)).toBe(true);
    spy.mockRestore();
    expect(ctx.getThreadId()).not.toBe(before);
    expect(ctx.getThreadId()).toMatch(/^session-/);
  });

  it('未知命令时提示并列出可用命令', async () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    expect(await handleSlashCommand('/no-such-cmd', makeCtx())).toBe(true);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('未知命令'));
    spy.mockRestore();
  });

  it('registerCommand 可扩展新命令', async () => {
    registerCommand({
      name: 'demo',
      usage: '/demo <x>',
      description: '测试命令',
      run: (args, ctx) => {
        ctx.setThreadId(`demo-${args}`);
      },
    });
    const ctx = makeCtx();
    expect(await handleSlashCommand('/demo abc', ctx)).toBe(true);
    expect(ctx.getThreadId()).toBe('demo-abc');
  });

  it('/rewind 缺少参数时提示用法', async () => {
    const ctx = makeCtx();
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    expect(await handleSlashCommand('/rewind', ctx)).toBe(true);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('用法'));
    spy.mockRestore();
    expect(ctx.getThreadId()).toBe('session-test-1'); // 未改变
  });

  it('/rewind 不存在的会话时提示错误且不切换', async () => {
    const ctx = makeCtx();
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    expect(await handleSlashCommand('/rewind no-such-thread-xyz', ctx)).toBe(true);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('会话不存在'));
    spy.mockRestore();
    expect(ctx.getThreadId()).toBe('session-test-1'); // 未改变
  });

  it('/compact 在空会话上提示暂无可压缩内容', async () => {
    const ctx = makeCtx();
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    expect(await handleSlashCommand('/compact', ctx)).toBe(true);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('压缩'));
    spy.mockRestore();
  });
});
