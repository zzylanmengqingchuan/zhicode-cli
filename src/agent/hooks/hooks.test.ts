import { loadHooksConfig, matchHooks, runHooks, type HooksConfig } from './hooks';

const CONFIG: HooksConfig = {
  hooks: {
    PreToolUse: [
      { matcher: 'exec', command: "echo 'Checking command...'" },
      { matcher: 'write', command: 'echo "blocked by policy" >&2; exit 1' },
      { matcher: 'web', command: 'echo "注意：即将访问网络" >&2; exit 2' },
    ],
    SessionStart: [{ matcher: '*', command: 'echo session started' }],
  },
};

describe('matchHooks', () => {
  it('matcher 匹配 name 中包含该字符串的工具', () => {
    expect(matchHooks('PreToolUse', 'exec', CONFIG).length).toBe(1);
    expect(matchHooks('PreToolUse', 'write_file', CONFIG).length).toBe(1);
    expect(matchHooks('PreToolUse', 'web_fetch', CONFIG).length).toBe(1);
    expect(matchHooks('PreToolUse', 'read_file', CONFIG).length).toBe(0);
  });

  it('未配置的事件返回空', () => {
    expect(matchHooks('PostToolUse', 'exec', CONFIG)).toEqual([]);
  });

  it('matcher 为 * 时匹配全部', () => {
    expect(matchHooks('SessionStart', 'anything', CONFIG).length).toBe(1);
  });
});

describe('runHooks', () => {
  it('exit 0 → continue', async () => {
    expect(await runHooks('PreToolUse', 'exec', {}, CONFIG)).toEqual({ action: 'continue' });
  });

  it('exit 1 → block，stderr 作为错误信息', async () => {
    const result = await runHooks('PreToolUse', 'write_file', {}, CONFIG);
    expect(result.action).toBe('block');
    expect(result).toMatchObject({ error: 'blocked by policy' });
  });

  it('exit 2 → inject，stderr 注入对话', async () => {
    const result = await runHooks('PreToolUse', 'web_fetch', {}, CONFIG);
    expect(result.action).toBe('inject');
    expect(result).toMatchObject({ message: '注意：即将访问网络' });
  });

  it('无匹配的 hook → continue', async () => {
    expect(await runHooks('PreToolUse', 'read_file', {}, CONFIG)).toEqual({
      action: 'continue',
    });
  });
});

describe('loadHooksConfig', () => {
  it('能读取项目自带的 hooks.json', () => {
    const config = loadHooksConfig();
    expect(config.hooks.PreToolUse?.[0]?.matcher).toBe('exec');
  });

  it('配置文件不存在时返回空配置', () => {
    expect(loadHooksConfig('/no/such/hooks.json')).toEqual({ hooks: {} });
  });
});
