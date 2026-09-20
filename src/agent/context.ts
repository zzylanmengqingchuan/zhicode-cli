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
