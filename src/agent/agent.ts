import * as path from 'node:path';
import { ChatOpenAI } from '@langchain/openai';
import {
  Annotation,
  Command,
  END,
  START,
  StateGraph,
  interrupt,
  messagesStateReducer,
  type CompiledStateGraph,
} from '@langchain/langgraph';
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage,
  type UsageMetadata,
} from '@langchain/core/messages';
import { config as loadEnv } from 'dotenv';
import { maybePersistedOutput, tools } from './tools.js';
import { buildSystemPrompt } from './prompt.js';
import { getModelContextLimit } from './context-stats.js';
import {
  capMessages,
  compressionRange,
  formatMessagesForCompression,
  simplifyToolMessages,
} from './context.js';
import { DB_PATH, initDb } from './db.js';
import { evaluateReadPermission } from './permission/read.js';
import { evaluateWritePermission } from './permission/write.js';
import { evaluateExecPermission } from './permission/exec.js';
import { evaluateNetworkPermission } from './permission/network.js';
import { runHooks } from './hooks/hooks.js';

// 全局命令运行时没有 --env-file，这里兜底加载 .env（不覆盖已有环境变量）
loadEnv({
  quiet: true,
  path: [
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../../../.env'),
    path.resolve(process.cwd(), '.env'),
  ],
});

// —— 模型 ———————————————————————————————————————————————————
export const MODEL_NAME = 'kimi-k2.6';
export const MODEL_BASE_URL = 'https://api.moonshot.cn/v1';

const model = new ChatOpenAI({
  model: MODEL_NAME,
  apiKey: process.env.MOONSHOT_API_KEY,
  configuration: {
    baseURL: MODEL_BASE_URL,
  },
  streaming: true,
});

const modelWithTools = model.bindTools(tools);

/**
 * 当前模型的最大上下文 token 数（动态查询模型服务方接口，带缓存）
 */
export function modelContextLimit(): Promise<number | null> {
  return getModelContextLimit(MODEL_NAME, process.env.MOONSHOT_API_KEY, MODEL_BASE_URL);
}

// —— Prompt 组装 ————————————————————————————————————————————
// 顺序：基础人设 → 用户画像（模板+.data/profile.md 实际信息）→ （memoryPrompt 预留）→ skills
const systemPrompt = buildSystemPrompt();

// —— State 定义 —————————————————————————————————————————————
// messages：完整的聊天记录（由 checkpointer 持久化，永不修改）
// llmInputMessages：手动指定的下一轮 LLM 输入（整体替换，优先级最高）
// summary / compressedUpTo / compressionCount：Context 压缩状态
//   summary 是前 compressedUpTo 条消息的摘要；modelRequest 动态拼
//   「摘要 + messages[compressedUpTo:]」发给 LLM，新消息自动进入上下文
const StateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  llmInputMessages: Annotation<BaseMessage[]>({
    // 写入即整体替换，不走追加
    reducer: (_, update) => messagesStateReducer([], update),
    default: () => [],
  }),
  summary: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),
  compressedUpTo: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),
  compressionCount: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),
});

type AgentState = typeof StateAnnotation.State;

export const SUMMARY_PREFIX = '【对话历史摘要】';

function getModelInputMessages(state: AgentState): BaseMessage[] {
  if (state.llmInputMessages != null && state.llmInputMessages.length > 0) {
    return capMessages(state.llmInputMessages);
  }
  if (state.summary && state.compressedUpTo > 0) {
    return capMessages([
      new SystemMessage(
        `${SUMMARY_PREFIX}以下是之前对话的压缩摘要，回答时请将其作为已知上下文：\n${state.summary}`,
      ),
      ...simplifyToolMessages(state.messages.slice(state.compressedUpTo)),
    ]);
  }
  return capMessages(simplifyToolMessages(state.messages));
}

// —— Graph 节点 —————————————————————————————————————————————
async function modelRequest(
  state: AgentState,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any,
): Promise<Partial<AgentState>> {
  const messages = [new SystemMessage(systemPrompt), ...getModelInputMessages(state)];
  const response = await modelWithTools.invoke(messages, config);
  return { messages: [response] };
}

function shouldContinue(state: AgentState): 'tools' | typeof END {
  const lastMessage = state.messages[state.messages.length - 1];
  if (AIMessage.isInstance(lastMessage) && lastMessage.tool_calls?.length) {
    return 'tools';
  }
  return END;
}

// 按工具的 permission_level 分发到对应的权限判定（read/write/exec 各自独立实现）
function evaluatePermission(
  toolName: string,
  args: unknown,
): { action: 'allow' | 'confirm' | 'block'; filepath?: string; reason?: string } {
  const tool = tools.find((t) => t.name === toolName);
  const level = (tool as { permission_level?: string } | undefined)?.permission_level;
  if (level === 'read') return evaluateReadPermission(args);
  if (level === 'write') return evaluateWritePermission(args);
  if (level === 'exec') return evaluateExecPermission(args);
  if (level === 'network') return evaluateNetworkPermission(args);
  return { action: 'confirm' };
}

async function toolNode(
  state: AgentState,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any,
): Promise<Partial<AgentState>> {
  const messages = state.messages;
  const toolMessageIds = new Set(
    messages
      .filter((msg) => msg.type === 'tool')
      .map((msg) => (msg as ToolMessage).tool_call_id),
  );

  let aiMessage: BaseMessage | undefined;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (AIMessage.isInstance(messages[i])) {
      aiMessage = messages[i];
      break;
    }
  }
  if (!aiMessage || !AIMessage.isInstance(aiMessage)) {
    throw new Error('toolNode 只接受最后一条消息为 AIMessage 的状态');
  }

  // 只执行还没有对应 ToolMessage 的工具调用
  const toolCalls =
    aiMessage.tool_calls?.filter((call) => call.id == null || !toolMessageIds.has(call.id)) ??
    [];

  const outputs: ToolMessage[] = [];
  for (const call of toolCalls) {
    // 权限判定：危险路径直接阻止；安全场景直接执行；其余需要用户确认
    const perm = evaluatePermission(call.name, call.args);
    if (perm.action === 'block') {
      outputs.push(
        new ToolMessage({
          content:
            perm.reason ??
            `操作已被安全策略阻止：路径 ${perm.filepath} 属于系统敏感目录，不能访问。请改用项目目录内的路径。`,
          tool_call_id: call.id ?? '',
          name: call.name,
        }),
      );
      continue;
    }

    if (perm.action === 'confirm') {
      // human-in-the-loop：interrupt 暂停 graph，等待调用方（CLI）传入用户决定
      const decision = interrupt({
        type: 'tool_confirm',
        name: call.name,
        args: call.args,
      }) as { approved?: boolean };
      if (!decision?.approved) {
        outputs.push(
          new ToolMessage({
            content: '用户拒绝了本次工具调用，请换一个思路回答或询问用户原因。',
            tool_call_id: call.id ?? '',
            name: call.name,
          }),
        );
        continue;
      }
    }

    // PreToolUse hooks：exit 1 阻止执行，exit 2 把信息注入对话
    const hookEnv = { TOOL_ARGS: JSON.stringify(call.args ?? {}) };
    const preHook = await runHooks('PreToolUse', call.name, hookEnv);
    if (preHook.action === 'block') {
      outputs.push(
        new ToolMessage({
          content: `PreToolUse hook 阻止了本次调用: ${preHook.error}`,
          tool_call_id: call.id ?? '',
          name: call.name,
        }),
      );
      continue;
    }

    // 统一在工具调用前打印日志（各工具实现内不再自行打印）
    console.log(`\n[Tool] ${call.name}`);
    const tool = tools.find((t) => t.name === call.name);
    try {
      if (!tool) throw new Error(`工具 "${call.name}" 不存在`);
      const output = await (
        tool as { invoke: (input: unknown, config?: unknown) => Promise<unknown> }
      ).invoke({ ...call, type: 'tool_call' }, config);
      const raw = typeof output === 'string' ? output : JSON.stringify(output);
      let content = await maybePersistedOutput(raw, call.id ?? 'unknown');

      // hook 注入的信息附加到工具结果中，随对话传递给模型
      const postHook = await runHooks('PostToolUse', call.name, hookEnv);
      const injections = [preHook, postHook]
        .filter((h): h is { action: 'inject'; message: string } => h.action === 'inject')
        .map((h) => h.message);
      if (injections.length > 0) {
        content += `\n\n[Hook 提示]\n${injections.join('\n')}`;
      }

      outputs.push(new ToolMessage({ content, tool_call_id: call.id ?? '', name: call.name }));
    } catch (err) {
      outputs.push(
        new ToolMessage({
          content: `Error: ${err instanceof Error ? err.message : String(err)}\n请修正后重试。`,
          tool_call_id: call.id ?? '',
          name: call.name,
        }),
      );
    }
  }

  return { messages: outputs };
}

// —— 记忆 ———————————————————————————————————————————————————
// 聊天记录持久化到当前目录的 .data/checkpointer.db，进程重启后记忆仍在
// 启动时初始化数据库表（memory 等），已存在则跳过
initDb();
const checkpointer = SqliteSaver.fromConnString(DB_PATH);

// —— Agent Graph ————————————————————————————————————————————
// 流程：START → model_request →（有工具调用 → tools → 回到 model_request）/（无 → END）
const workflow = new StateGraph(StateAnnotation)
  .addNode('model_request', modelRequest)
  .addNode('tools', toolNode)
  .addEdge(START, 'model_request')
  .addConditionalEdges('model_request', shouldContinue, {
    tools: 'tools',
    [END]: END,
  })
  .addEdge('tools', 'model_request');

export const agent = workflow.compile({ checkpointer }) as CompiledStateGraph<
  unknown,
  unknown,
  string
>;

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
