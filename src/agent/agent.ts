import { Command } from '@langchain/langgraph';
import { HumanMessage, SystemMessage, type BaseMessage, type UsageMetadata } from '@langchain/core/messages';
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';
import { tools } from './tools.js';
import { buildSystemPrompt } from './prompt.js';
import { getModelContextLimit } from './context-stats.js';
import { buildAgentGraph, model, MODEL_BASE_URL, MODEL_NAME } from './graph.js';
import { compressionRange, formatMessagesForCompression } from './context.js';
import { DB_PATH, initDb } from './db.js';
import { closeMcp, loadMcpTools } from './mcp/client.js';

// graph.ts 中已完成 .env 加载与模型初始化，这里无需重复

// —— Prompt 组装 ————————————————————————————————————————————
// 顺序：基础人设 → 用户画像（模板+.data/profile.md 实际信息）→ （memoryPrompt 预留）→ skills
const systemPrompt = buildSystemPrompt();

/**
 * 当前模型的最大上下文 token 数（动态查询模型服务方接口，带缓存）
 */
export function modelContextLimit(): Promise<number | null> {
  return getModelContextLimit(MODEL_NAME, process.env.MOONSHOT_API_KEY, MODEL_BASE_URL);
}

// —— 记忆 ———————————————————————————————————————————————————
// 聊天记录持久化到当前目录的 .data/checkpointer.db，进程重启后记忆仍在
// 启动时初始化数据库表（memory 等），已存在则跳过
initDb();
const checkpointer = SqliteSaver.fromConnString(DB_PATH);

// —— Agent 初始化 ———————————————————————————————————————————
// MCP 工具需要异步连接，所以 agent 改为显式初始化
let agentInstance: ReturnType<typeof buildAgentGraph> | null = null;
let allTools: typeof tools = tools;

/**
 * 初始化 main agent：加载 MCP 工具并与本地工具合并。
 * 在 cli 启动时调用一次；重复调用幂等。
 * @param options.loadMcp 测试时可传 false 跳过 MCP 连接（避免拉起子进程）
 */
export async function initAgent(options: { loadMcp?: boolean } = {}): Promise<void> {
  if (agentInstance) return;
  const mcpTools = options.loadMcp === false ? [] : await loadMcpTools();
  allTools = [...tools, ...mcpTools] as typeof tools;
  agentInstance = buildAgentGraph({
    tools: allTools,
    checkpointer,
    systemPrompt,
  });
}

/** 全部工具（本地 + MCP），subagent 也用这份（过滤掉 agent 工具） */
export function getAllTools(): typeof tools {
  return allTools;
}

function getAgent(): ReturnType<typeof buildAgentGraph> {
  if (!agentInstance) {
    throw new Error('agent 未初始化，请先调用 initAgent()');
  }
  return agentInstance;
}

/**
 * 关闭 agent 相关资源（MCP server 子进程等），进程退出前调用
 */
export async function closeAgent(): Promise<void> {
  await closeMcp();
}

export interface AgentStreamResult {
  text: string;
  /** 本轮请求模型实际收到的上下文 token 数（取不到时为 null） */
  contextTokens: number | null;
}

/** 工具调用确认请求（human-in-the-loop） */
export interface ToolConfirmRequest {
  type: string;
  name: string;
  args: unknown;
}

/**
 * 以流式方式运行 agent，将 token 逐个回调给调用方
 * @param userMessage - 当前用户输入（历史已由 checkpointer 自动续接）
 * @param onToken - 每个 token 到来时的回调 (token: string) => void
 * @param threadId - 会话 ID，相同 ID 自动续上历史记录
 * @param signal - 可选的中止信号，触发后取消本次 AI 请求
 * @param confirm - 工具调用前的用户确认回调；不传则自动允许（非交互场景）
 * @returns 完整的 AI 回复文本 + 本轮上下文 token 用量
 */
export async function runAgentStream(
  userMessage: string,
  onToken: (token: string) => void,
  threadId: string = 'default-session',
  signal?: AbortSignal,
  confirm?: (request: ToolConfirmRequest) => Promise<boolean>,
): Promise<AgentStreamResult> {
  const config = { configurable: { thread_id: threadId }, signal };

  let fullResponse = '';
  let usageMetadata: UsageMetadata | undefined;
  let input: { messages: HumanMessage[] } | Command =
    { messages: [new HumanMessage(userMessage)] };

  // interrupt 会暂停 graph；用户确认后用 Command({ resume }) 继续，循环直到没有待确认的调用
  const agent = getAgent();
  for (;;) {
    const stream = await agent.stream(input, { ...config, streamMode: 'messages' });

    for await (const chunk of stream as AsyncIterable<[unknown, Record<string, unknown>]>) {
      if (signal?.aborted) {
        throw new Error('本次请求已被取消');
      }

      const message = chunk[0];
      const metadata = chunk[1];

      if (metadata?.langgraph_node !== 'model_request') continue;

      const chunkUsage = (message as { usage_metadata?: UsageMetadata }).usage_metadata;
      if (chunkUsage) {
        usageMetadata = chunkUsage;
      }

      // AIMessageChunk 的 content 在 message.content 属性上，不在 kwargs.content
      const content: string =
        ((message as { content?: string }).content ??
          (message as { kwargs?: { content?: string } }).kwargs?.content ??
          '') as string;
      const toolCallChunks =
        (message as { tool_call_chunks?: unknown[] }).tool_call_chunks ?? [];

      if (!content || toolCallChunks.length > 0) continue;

      onToken(content);
      fullResponse += content;
    }

    // 检查是否有暂停待确认的 interrupt
    const state = (await agent.getState(config)) as {
      tasks?: { interrupts?: { value: ToolConfirmRequest }[] }[];
    };
    const pending = (state.tasks ?? []).flatMap((t) => t.interrupts ?? []);
    if (pending.length === 0) break;

    const approved = confirm ? await confirm(pending[0].value) : true;
    input = new Command({ resume: { approved } });
  }

  return { text: fullResponse, contextTokens: usageMetadata?.input_tokens ?? null };
}

// —— Context 压缩（agent 核心能力） —————————————————————————

/**
 * 调用 AI 把「已有摘要 + 新对话内容」合并压缩成一份新摘要
 */
async function summarize(existingSummary: string, newContent: string): Promise<string> {
  const response = await model.invoke([
    new SystemMessage(
      '你在为一个 AI 助手压缩对话历史。把对话压缩成简洁摘要，保留关键信息：用户身份与偏好、已完成的任务、重要结论、待办事项；删除寒暄与冗余。输出纯文本摘要，不超过 500 字。',
    ),
    new HumanMessage(
      `【已有摘要】（可能为空）\n${existingSummary || '（无）'}\n\n【需要新压缩的对话】\n${newContent}\n\n请输出合并后的完整摘要（把已有摘要与新内容合并去重，而不是分开罗列）。`,
    ),
  ]);

  return typeof response.content === 'string'
    ? response.content
    : JSON.stringify(response.content);
}

export interface CompressOutcome {
  /** 本轮新压缩的消息条数 */
  compressedMessages: number;
  /** 累计压缩次数（含本次） */
  compressionCount: number;
  /** 压缩后的完整摘要 */
  summary: string;
}

interface CompressibleState {
  messages?: BaseMessage[];
  summary?: string;
  compressedUpTo?: number;
  compressionCount?: number;
}

/**
 * 压缩指定会话的 Context：
 * 把 messages 中「已压缩位置之后、最近 6 条之前」的消息调用 AI 总结，
 * 摘要写回 agent state（不动 messages 原始记录），供下一轮对话使用。
 * 没有新内容可压缩时返回 null。
 */
export async function compressContext(threadId: string): Promise<CompressOutcome | null> {
  const config = { configurable: { thread_id: threadId } };
  const agent = getAgent();
  const state = (await agent.getState(config)) as { values?: CompressibleState };
  const values = state.values ?? {};

  const messages = values.messages ?? [];
  const compressedUpTo = values.compressedUpTo ?? 0;
  const compressionCount = values.compressionCount ?? 0;

  const range = compressionRange(messages.length, compressedUpTo);
  if (!range) return null;

  const toCompress = messages.slice(range.start, range.end);
  const summary = await summarize(
    values.summary ?? '',
    formatMessagesForCompression(toCompress),
  );

  await agent.updateState(config, {
    summary,
    compressedUpTo: range.end,
    compressionCount: compressionCount + 1,
  });

  return {
    compressedMessages: toCompress.length,
    compressionCount: compressionCount + 1,
    summary,
  };
}
