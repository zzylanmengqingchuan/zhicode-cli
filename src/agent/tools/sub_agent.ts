import { randomUUID } from 'node:crypto';
import { Command, MemorySaver } from '@langchain/langgraph';
import { AIMessage, HumanMessage, type BaseMessage } from '@langchain/core/messages';
import { buildAgentGraph } from '../graph.js';
import { buildSystemPrompt } from '../prompt.js';

/**
 * agent 工具的具体实现：启动一个 subagent 独立完成一个任务
 *
 * 规则：
 * - 只接收纯文本 prompt，子 agent 看不到当前对话记录（全新会话）
 * - 与 main agent 共享 buildAgentGraph 构建逻辑（同一套 StateGraph / 权限 / hooks / skills / memory）
 * - 子 agent 可用除 agent 外的所有工具（不能嵌套启动 subagent）
 * - 使用 MemorySaver（一次性会话，不做 context 压缩）
 * - 子 agent 内部的工具确认自动允许（启动 subagent 本身已经过用户确认）
 * - 执行结束后返回最终回复文本给 main agent
 */
export async function runSubAgent(prompt: string): Promise<string> {
  // 延迟加载，避免与注册中心的循环依赖；取合并后的全部工具（含 MCP），但排除 agent（不能嵌套）
  const { getAllTools } = require('../agent.js') as typeof import('../agent.js');
  const subTools = getAllTools().filter((t) => t.name !== 'agent');

  const subAgent = buildAgentGraph({
    tools: subTools,
    checkpointer: new MemorySaver(),
    systemPrompt: buildSystemPrompt(),
  });

  const config = { configurable: { thread_id: `subagent-${randomUUID()}` } };
  let input: { messages: HumanMessage[] } | Command = {
    messages: [new HumanMessage(prompt)],
  };

  for (;;) {
    await subAgent.invoke(input as never, config);
    const state = (await subAgent.getState(config)) as {
      tasks?: { interrupts?: unknown[] }[];
    };
    const pending = (state.tasks ?? []).flatMap((t) => t.interrupts ?? []);
    if (pending.length === 0) break;
    input = new Command({ resume: { approved: true } });
  }

  const finalState = (await subAgent.getState(config)) as {
    values?: { messages?: BaseMessage[] };
  };
  const messages = finalState.values?.messages ?? [];
  const lastAI = [...messages]
    .reverse()
    .find((m) => AIMessage.isInstance(m) && m.content);
  if (!lastAI) return '(subagent 没有返回结果)';
  return typeof lastAI.content === 'string'
    ? lastAI.content
    : JSON.stringify(lastAI.content);
}
