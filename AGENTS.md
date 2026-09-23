# AGENTS.md

This file provides guidance to Kimi Code (and other AI coding agents) when working with code in this repository.

## Project Overview

zhiwen（知文）— 一个 TypeScript AI 命令行助手，基于 LangChain v1 ReAct Agent，支持多模型（配置在 ~/.zhiwen/zhiwen.json）、MCP 工具、skills、长期记忆与 hooks。

## Tech Stack

- **Runtime**: Node.js 22
- **Language**: TypeScript 5.9（strict mode，module/moduleResolution: NodeNext）
- **Package Manager**: pnpm 11（不要用 npm / yarn）
- **Testing**: Jest 30 + ts-jest，测试文件与源码同目录，命名为 `*.test.ts`
- **AI 框架**: LangChain v1.x（langchain / @langchain/core / @langchain/langgraph）

## Common Commands

```bash
pnpm build           # 编译 TypeScript 到 dist/
pnpm typecheck       # 仅类型检查（tsc --noEmit）
pnpm test            # 运行 Jest 单元测试
pnpm test:watch      # watch 模式
pnpm test:coverage   # 生成覆盖率报告（输出到 coverage/）
```

## Project Structure

```
src/
  index.ts          # 示例代码
  index.test.ts     # 测试与源码同目录
  agent/
    agent.ts        # ReAct Agent：tool + model（Kimi/moonshot）+ createAgent + runAgent/runAgentStream
    cli.ts          # 控制台交互入口（pnpm dev / pnpm start）
dist/               # 编译产物（不入库）
```

## Important Notes

- **TypeScript 固定在 ^5**：ts-jest 尚不支持 TypeScript 7，不要升级 typescript 到 7.x。
- **pnpm 11 构建脚本审批**：原生依赖（如 @parcel/watcher、unrs-resolver）的 postinstall 默认被禁用，需在 `pnpm-workspace.yaml` 的 `allowBuilds` 中声明，否则 `pnpm install` 会以非零码退出。
- 新增源码文件放在 `src/` 下，并配套 `*.test.ts` 测试。

---

# Karpathy-Inspired Guidelines

> 以下来自 [andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills)，用于减少 LLM 编程常见错误。

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
