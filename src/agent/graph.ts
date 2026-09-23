import * as path from 'node:path';
import { ChatOpenAI } from '@langchain/openai';
import {
  Annotation,
  END,
  START,
  StateGraph,
  interrupt,
  messagesStateReducer,
  type BaseCheckpointSaver,
  type CompiledStateGraph,
} from '@langchain/langgraph';
import {
  AIMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage,
} from '@langchain/core/messages';
import { config as loadEnv } from 'dotenv';
import { maybePersistedOutput } from './tools/persist_output.js';
import {
  capMessages,
  simplifyToolMessages,
} from './context.js';
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

export const model = new ChatOpenAI({
  model: MODEL_NAME,
  apiKey: process.env.MOONSHOT_API_KEY,
  configuration: {
    baseURL: MODEL_BASE_URL,
  },
  streaming: true,
});

/** 图可执行的最小工具形态（结构化工具实例） */
export interface GraphTool {
  name: string;
  permission_level?: string;
}

// —— State 定义 —————————————————————————————————————————————
// messages：完整的聊天记录（由 checkpointer 持久化，永不修改）
// llmInputMessages：手动指定的下一轮 LLM 输入（整体替换，优先级最高）
// summary / compressedUpTo / compressionCount：Context 压缩状态（仅 main agent 使用）
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

// 按工具的 permission_level 分发到对应的权限判定（read/write/exec/network 各自独立实现）
function evaluatePermission(
  agentTools: GraphTool[],
  toolName: string,
  args: unknown,
): { action: 'allow' | 'confirm' | 'block'; filepath?: string; reason?: string } {
  const tool = agentTools.find((t) => t.name === toolName);
  const level = tool?.permission_level;
  if (level === 'read') return evaluateReadPermission(args);
  if (level === 'write') return evaluateWritePermission(args);
  if (level === 'exec') return evaluateExecPermission(args);
  if (level === 'network') return evaluateNetworkPermission(args);
  return { action: 'confirm' };
}

export interface BuildAgentOptions {
  /** 该 agent 可用的工具列表 */
  tools: GraphTool[];
  /** 记忆存储（main agent 用 SqliteSaver，subagent 用 MemorySaver） */
  checkpointer: BaseCheckpointSaver;
  systemPrompt: string;
}

/**
 * 构建 ReAct Agent graph（main agent 与 subagent 共享同一套构建逻辑）
 * 流程：START → model_request →（有工具调用 → tools → 回到 model_request）/（无 → END）
 */
export function buildAgentGraph(options: BuildAgentOptions): CompiledStateGraph<unknown, unknown, string> {
  const { tools: agentTools, checkpointer, systemPrompt } = options;
  const modelWithTools = model.bindTools(agentTools as never[]);

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
      const perm = evaluatePermission(agentTools, call.name, call.args);
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
      const tool = agentTools.find((t) => t.name === call.name);
      try {
        if (!tool) throw new Error(`工具 "${call.name}" 不存在`);
        const output = await (
          tool as unknown as { invoke: (input: unknown, config?: unknown) => Promise<unknown> }
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

  const workflow = new StateGraph(StateAnnotation)
    .addNode('model_request', modelRequest)
    .addNode('tools', toolNode)
    .addEdge(START, 'model_request')
    .addConditionalEdges('model_request', shouldContinue, {
      tools: 'tools',
      [END]: END,
    })
    .addEdge('tools', 'model_request');

  return workflow.compile({ checkpointer }) as CompiledStateGraph<unknown, unknown, string>;
}
