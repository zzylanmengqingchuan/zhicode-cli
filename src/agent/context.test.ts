import { AIMessage, HumanMessage, ToolMessage } from '@langchain/core/messages';
import {
  compressionRange,
  formatMessagesForCompression,
  KEEP_RECENT_MESSAGES,
} from './context';

describe('compressionRange', () => {
  it('有足够消息时返回可压缩区间', () => {
    // 10 条消息，保留最近 6 条 → 压缩 [0, 4)
    expect(compressionRange(10, 0)).toEqual({ start: 0, end: 4 });
  });

  it('保留最近 6 条不压缩', () => {
    // 20 条消息 → end = 20 - 6 = 14
    expect(compressionRange(20, 0)).toEqual({ start: 0, end: 14 });
  });

  it('从上次压缩位置继续，不重复压缩', () => {
    // 已压缩到 14，现在 20 条 → 只压缩 [14, 14)... 即没有新内容
    expect(compressionRange(20, 14)).toBeNull();
    // 现在 24 条 → 压缩 [14, 18)
    expect(compressionRange(24, 14)).toEqual({ start: 14, end: 18 });
  });

  it('消息不足 6 条时无可压缩内容', () => {
    expect(compressionRange(KEEP_RECENT_MESSAGES, 0)).toBeNull();
    expect(compressionRange(3, 0)).toBeNull();
  });
});

describe('formatMessagesForCompression', () => {
  it('按角色标注格式化消息', () => {
    const text = formatMessagesForCompression([
      new HumanMessage('你好'),
      new AIMessage('你好！有什么可以帮你？'),
      new ToolMessage({ content: '文件已写入', tool_call_id: '1', name: 'write_file' }),
    ]);
    expect(text).toContain('用户: 你好');
    expect(text).toContain('AI: 你好！有什么可以帮你？');
    expect(text).toContain('工具(write_file): 文件已写入');
  });

  it('超长内容会被截断', () => {
    const text = formatMessagesForCompression([new HumanMessage('长'.repeat(1000))]);
    expect(text.length).toBeLessThan(600);
    expect(text).toContain('…');
  });
});
