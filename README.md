# zhiwen（知问）

AI 命令行助手，基于 LangChain v1 ReAct Agent，支持多模型（Kimi / DeepSeek / GLM 等）、MCP 工具、Skills、长期记忆与 Hooks。

## 安装

```bash
npm install -g zhiwen
```

## 配置

首次使用前，在 `~/.zhiwen/zhiwen.json` 中配置你的模型 API Key（如 Moonshot/Kimi），或通过环境变量提供：

```bash
export MOONSHOT_API_KEY=sk-...
# 可选：联网搜索
export TAVILY_API_KEY=tvly-...
```

## 使用

```bash
zhiwen          # 进入交互式对话
zhiwen -v       # 显示版本号
zhiwen -h       # 查看帮助
```

## 特性

- 🤖 基于 LangChain ReAct Agent 的多轮工具调用
- 🔌 支持 MCP（Model Context Protocol）工具扩展
- 🧠 长期记忆（SQLite 持久化，存储于 `~/.zhiwen`）
- 🧩 Skills 系统，可扩展专业能力
- 🪝 Hooks 机制，自定义生命周期行为
- 🌐 多模型支持：Kimi / DeepSeek / GLM 等 OpenAI 兼容接口

## License

ISC
