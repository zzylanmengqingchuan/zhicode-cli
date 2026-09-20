import * as fs from 'node:fs';
import * as path from 'node:path';
import { ChatOpenAI } from '@langchain/openai';
import { createAgent } from 'langchain';
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';
import { config as loadEnv } from 'dotenv';
import { tools } from './tools.js';
import { listSkills, skillsPrompt } from './skills.js';
import { getModelContextLimit } from './context-stats.js';

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
const MODEL_NAME = 'kimi-k2.6';
const MODEL_BASE_URL = 'https://api.moonshot.cn/v1';

const model = new ChatOpenAI({
  model: MODEL_NAME,
  apiKey: process.env.MOONSHOT_API_KEY,
  configuration: {
    baseURL: MODEL_BASE_URL,
  },
  streaming: true,
});

/**
 * 当前模型的最大上下文 token 数（动态查询模型服务方接口，带缓存）
 */
export function modelContextLimit(): Promise<number | null> {
  return getModelContextLimit(MODEL_NAME, process.env.MOONSHOT_API_KEY, MODEL_BASE_URL);
}

// —— Agent 创建 —————————————————————————————————————————————
// 启动时扫描 skills 目录，把 name/description 注入 system prompt，每次请求都会携带
const skills = listSkills();

// 聊天记录持久化到当前目录的 .data/checkpointer.db，进程重启后记忆仍在
const DATA_DIR = path.resolve(process.cwd(), '.data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const checkpointer = SqliteSaver.fromConnString(path.join(DATA_DIR, 'checkpointer.db'));

export const agent = createAgent({
  model,
  tools,
  systemPrompt: `You are a helpful assistant.${skillsPrompt(skills)}`,
  checkpointer,
});

export async function runAgent(
  userMessage: string,
  threadId: string = 'default-session',
): Promise<string> {
  const result = await agent.invoke(
    { messages: [{ role: 'user', content: userMessage }] },
    { configurable: { thread_id: threadId } },
  );
  const last = result.messages[result.messages.length - 1];
  return typeof last.content === 'string' ? last.content : JSON.stringify(last.content);
}

export interface AgentStreamResult {
  text: string;
  /** 本轮请求模型实际收到的上下文 token 数（取不到时为 null） */
  contextTokens: number | null;
}

/**
 * 以流式方式运行 agent，将 token 逐个回调给调用方
 * @param userMessage - 当前用户输入（历史已由 checkpointer 自动续接）
 * @param onToken - 每个 token 到来时的回调 (token: string) => void
 * @param threadId - 会话 ID，相同 ID 自动续上历史记录
 * @param signal - 可选的中止信号，触发后取消本次 AI 请求
 * @returns 完整的 AI 回复文本 + 本轮上下文 token 用量
 */
export async function runAgentStream(
  userMessage: string,
  onToken: (token: string) => void,
  threadId: string = 'default-session',
  signal?: AbortSignal,
): Promise<AgentStreamResult> {
  const config = { configurable: { thread_id: threadId }, signal };

  const stream = await agent.stream(
    { messages: [{ role: 'user', content: userMessage }] },
    { ...config, streamMode: 'messages' },
  );

  let fullResponse = '';

  for await (const chunk of stream as AsyncIterable<[unknown, Record<string, unknown>]>) {
    const message = chunk[0];
    const metadata = chunk[1];

    if (metadata?.langgraph_node !== 'model_request') continue;

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

  // 从最终状态里取最后一条带 usage_metadata 的消息，input_tokens 即模型实际收到的上下文 token 数
  let contextTokens: number | null = null;
  try {
    const state = (await agent.getState({
      configurable: { thread_id: threadId },
    })) as { values?: { messages?: { usage_metadata?: { input_tokens?: number } }[] } };
    const messages = state.values?.messages ?? [];
    const lastWithUsage = [...messages].reverse().find((m) => m.usage_metadata);
    contextTokens = lastWithUsage?.usage_metadata?.input_tokens ?? null;
  } catch {
    contextTokens = null;
  }

  return { text: fullResponse, contextTokens };
}
