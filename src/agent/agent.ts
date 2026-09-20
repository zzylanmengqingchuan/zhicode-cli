import * as path from 'node:path';
import { ChatOpenAI } from '@langchain/openai';
import { createAgent, tool } from 'langchain';
import { MemorySaver } from '@langchain/langgraph';
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

// 全局命令运行时没有 --env-file，这里兜底加载 .env（不覆盖已有环境变量）
loadEnv({
  quiet: true,
  path: [
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../../../.env'),
    path.resolve(process.cwd(), '.env'),
  ],
});

// —— 工具定义 ————————————————————————————————————————————————
const search = tool(
  async ({ query }) => {
    console.log(`\n[Tool] search called: "${query}"`);

    if (
      query.toLowerCase().includes('sf') ||
      query.toLowerCase().includes('san francisco')
    ) {
      return "It's 60 degrees and foggy.";
    }
    return "It's 90 degrees and sunny.";
  },
  {
    name: 'search',
    description: 'Call to surf the web.',
    schema: z.object({
      query: z.string().describe('The query to use in your search.'),
    }),
  },
);

// —— 模型 ———————————————————————————————————————————————————
const model = new ChatOpenAI({
  model: 'kimi-k2.6',
  apiKey: process.env.MOONSHOT_API_KEY,
  configuration: {
    baseURL: 'https://api.moonshot.cn/v1',
  },
  streaming: true,
});

// —— Agent 创建 —————————————————————————————————————————————
export const agent = createAgent({
  model,
  tools: [search],
  systemPrompt: 'You are a helpful assistant.',
  checkpointer: new MemorySaver(),
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

/**
 * 以流式方式运行 agent，将 token 逐个回调给调用方
 * @param userMessage - 当前用户输入（历史已由 checkpointer 自动续接）
 * @param onToken - 每个 token 到来时的回调 (token: string) => void
 * @param threadId - 会话 ID，相同 ID 自动续上历史记录
 * @returns 完整的 AI 回复文本
 */
export async function runAgentStream(
  userMessage: string,
  onToken: (token: string) => void,
  threadId: string = 'default-session',
): Promise<string> {
  const config = { configurable: { thread_id: threadId } };

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

  return fullResponse;
}
