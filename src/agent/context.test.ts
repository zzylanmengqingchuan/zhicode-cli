import { AIMessage, HumanMessage, ToolMessage } from '@langchain/core/messages';
import {
  capMessages,
  compressionRange,
  formatMessagesForCompression,
  KEEP_RECENT_MESSAGES,
  simplifyToolMessages,
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

describe('simplifyToolMessages', () => {
  function toolMsg(name: string, content: string, id: string) {
    return new ToolMessage({ content, name, tool_call_id: id });
  }

  it('较早的 tool message 被简化为 [Previous: used xxx]', () => {
    const messages = [
      new HumanMessage('搜索 aaa'),
      toolMsg('search', '很长的搜索结果'.repeat(100), 't1'),
      new AIMessage('找到了 aaa'),
      toolMsg('exec', '很长的命令输出'.repeat(100), 't2'),
      toolMsg('run_js', '很长的执行结果'.repeat(100), 't3'),
      toolMsg('write_file', '文件已写入', 't4'),
      new AIMessage('完成'),
    ];
    const result = simplifyToolMessages(messages);

    // t1 是最早的 tool message（共 4 条，保留最近 3 条）→ 被简化
    expect((result[1] as ToolMessage).content).toBe('[Previous: used search]');
    // t2/t3/t4 是最近 3 条 → 保持原文
    expect((result[3] as ToolMessage).content).toContain('很长的命令输出');
    expect((result[4] as ToolMessage).content).toContain('很长的执行结果');
    expect((result[5] as ToolMessage).content).toBe('文件已写入');
    // 其他类型消息不动
    expect((result[0] as HumanMessage).content).toBe('搜索 aaa');
    expect((result[2] as AIMessage).content).toBe('找到了 aaa');
    // 原数组不被修改（不影响 checkpointer 存储）
    expect((messages[1] as ToolMessage).content).toContain('很长的搜索结果');
  });

  it('tool message 不超过 3 条时全部保持原文', () => {
    const messages = [toolMsg('exec', '输出1', 't1'), toolMsg('exec', '输出2', 't2')];
    const result = simplifyToolMessages(messages);
    expect((result[0] as ToolMessage).content).toBe('输出1');
    expect((result[1] as ToolMessage).content).toBe('输出2');
  });

  it('read_file 工具的内容永远不简化', () => {
    const messages = [
      toolMsg('read_file', '文件完整内容'.repeat(100), 't1'),
      toolMsg('exec', '输出', 't2'),
      toolMsg('exec', '输出', 't3'),
      toolMsg('exec', '输出', 't4'),
      toolMsg('exec', '输出', 't5'),
    ];
    const result = simplifyToolMessages(messages);
    // t1 虽然是较早的 tool message，但 read_file 在白名单中
    expect((result[0] as ToolMessage).content).toContain('文件完整内容');
    // t2 被简化（最近 3 条是 t3/t4/t5）
    expect((result[1] as ToolMessage).content).toBe('[Previous: used exec]');
  });
});

describe('capMessages', () => {
  it('消息数不超过 300 时原样返回', () => {
    const messages = [new HumanMessage('a'), new AIMessage('b')];
    expect(capMessages(messages)).toBe(messages);
  });

  it('超过 300 条时只保留最近 300 条', () => {
    const messages = Array.from({ length: 350 }, (_, i) => new HumanMessage(`消息 ${i}`));
    const result = capMessages(messages);
    expect(result.length).toBe(300);
    expect((result[0] as HumanMessage).content).toBe('消息 50'); // 最旧的 50 条被裁掉
    expect((result[299] as HumanMessage).content).toBe('消息 349');
  });

  it('裁剪后去掉开头孤立的 ToolMessage', () => {
    const messages = [
      ...Array.from({ length: 299 }, (_, i) => new HumanMessage(`消息 ${i}`)),
      new ToolMessage({ content: '工具结果', name: 'exec', tool_call_id: 'orphan' }),
      new HumanMessage('最后一条'),
    ];
    // 共 301 条，裁掉最早的 1 条后开头是 HumanMessage，无孤儿
    expect(capMessages(messages).length).toBe(300);

    const withOrphan = [
      new HumanMessage('被裁掉的消息'),
      new ToolMessage({ content: '旧工具结果', name: 'exec', tool_call_id: 'old' }),
      ...Array.from({ length: 299 }, (_, i) => new HumanMessage(`消息 ${i}`)),
    ];
    // 301 条，slice(-300) 裁掉第一条 HumanMessage 后开头剩孤儿 ToolMessage，应被去掉
    const result = capMessages(withOrphan);
    expect(ToolMessage.isInstance(result[0])).toBe(false);
    expect(result.length).toBe(299);
  });
});
