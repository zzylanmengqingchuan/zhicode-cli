import { formatContextUsage, isContextNearLimit } from './context-stats';

describe('formatContextUsage', () => {
  it('正常显示 当前/上限（占比）', () => {
    expect(formatContextUsage(1234, 262144)).toBe('上下文: 1,234 / 262,144 tokens（0.5%）');
  });

  it('占比保留一位小数', () => {
    expect(formatContextUsage(131072, 262144)).toBe('上下文: 131,072 / 262,144 tokens（50.0%）');
  });

  it('上限未知时只显示当前值', () => {
    expect(formatContextUsage(500, null)).toBe('上下文: 500 tokens（上限未知）');
  });

  it('当前值未知时显示未知', () => {
    expect(formatContextUsage(null, 262144)).toBe('上下文: 未知 / 262,144 tokens（0.0%）');
  });

  it('都未知时也能正常输出', () => {
    expect(formatContextUsage(null, null)).toBe('上下文: 未知 tokens（上限未知）');
  });
});

describe('isContextNearLimit', () => {
  const MAX = 262144;

  it('达到 80% 时告警', () => {
    expect(isContextNearLimit(MAX * 0.8, MAX)).toBe(true);
  });

  it('超过 80% 时告警', () => {
    expect(isContextNearLimit(MAX * 0.95, MAX)).toBe(true);
  });

  it('低于 80% 时不告警', () => {
    expect(isContextNearLimit(MAX * 0.79, MAX)).toBe(false);
  });

  it('任一值未知时不告警', () => {
    expect(isContextNearLimit(null, MAX)).toBe(false);
    expect(isContextNearLimit(100, null)).toBe(false);
    expect(isContextNearLimit(null, null)).toBe(false);
  });
});
