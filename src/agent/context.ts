import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage,
} from '@langchain/core/messages';

/** 压缩时保留最近几条消息不动 */
export const KEEP_RECENT_MESSAGES = 6;

/** 单条消息内容的最大长度（防止超长工具输出撑爆压缩请求） */
const MAX_MESSAGE_CONTENT = 500;

function roleLabel(m: BaseMessage): string {
  if (HumanMessage.isInstance(m)) return '用户';
  if (AIMessage.isInstance(m)) return 'AI';
  if (ToolMessage.isInstance(m)) return `工具(${m.name ?? 'unknown'})`;
  if (SystemMessage.isInstance(m)) return '系统';
  return m.getType();
}

function messageContent(m: BaseMessage): string {
  const text =
    typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > MAX_MESSAGE_CONTENT
    ? `${oneLine.slice(0, MAX_MESSAGE_CONTENT)}…`
    : oneLine;
}

/**
 * 把消息列表格式化为压缩用的纯文本
 */
export function formatMessagesForCompression(messages: BaseMessage[]): string {
  return messages.map((m) => `${roleLabel(m)}: ${messageContent(m)}`).join('\n');
}

/**
 * 计算本轮可压缩的消息区间 [start, end)
 * 规则：保留最近 KEEP_RECENT_MESSAGES 条不压缩；没有新内容可压缩时返回 null
 */
export function compressionRange(
  totalMessages: number,
  compressedUpTo: number,
): { start: number; end: number } | null {
  const end = totalMessages - KEEP_RECENT_MESSAGES;
  if (end <= compressedUpTo) return null;
  return { start: compressedUpTo, end };
}

/** 最近几条 tool message 保持完整不简化 */
export const KEEP_RECENT_TOOL_MESSAGES = 3;

/** 发送给模型的消息数上限（兜底裁剪，超出部分从最旧的开始丢） */
export const MAX_MODEL_MESSAGES = 300;

/**
 * 兜底裁剪：最多保留最近 MAX_MODEL_MESSAGES 条消息。
 * 裁剪后开头若有孤立的 ToolMessage（对应的 AI tool_calls 已被裁掉）一并去掉，
 * 否则模型接口会报 400。
 */
export function capMessages(messages: BaseMessage[]): BaseMessage[] {
  if (messages.length <= MAX_MODEL_MESSAGES) return messages;
  let capped = messages.slice(-MAX_MODEL_MESSAGES);
  while (capped.length > 0 && ToolMessage.isInstance(capped[0])) {
    capped = capped.slice(1);
  }
  return capped;
}

/** 这些工具的输出保留原文，不简化（内容对后续对话有持续价值） */
const NO_SIMPLIFY_TOOLS = new Set(['read_file']);

/**
 * 简化历史消息中的 tool message：除最近 KEEP_RECENT_TOOL_MESSAGES 条和
 * 白名单工具外，内容统一替换为 `[Previous: used 工具名]`。
 * 返回新数组，不修改原消息（checkpointer 存储的记录不受影响）。
 */
export function simplifyToolMessages(messages: BaseMessage[]): BaseMessage[] {
  const toolIndexes = messages
    .map((m, i) => (ToolMessage.isInstance(m) ? i : -1))
    .filter((i) => i >= 0);
  const keepRecent = new Set(toolIndexes.slice(-KEEP_RECENT_TOOL_MESSAGES));

  return messages.map((m, i) => {
    if (!ToolMessage.isInstance(m)) return m;
    if (keepRecent.has(i)) return m;
    if (m.name && NO_SIMPLIFY_TOOLS.has(m.name)) return m;
    return new ToolMessage({
      content: `[Previous: used ${m.name ?? 'unknown'}]`,
      tool_call_id: m.tool_call_id,
      name: m.name,
    });
  });
}
