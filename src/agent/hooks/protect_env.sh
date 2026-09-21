#!/bin/bash
# PreToolUse hook: 保护 .env 文件不被读取
# 上下文通过环境变量传入：TOOL_NAME / TOOL_ARGS（JSON 字符串，含 filePath 字段）

# 匹配 .env / .env.local / .env.production 等文件
if echo "$TOOL_ARGS" | grep -qE '"filePath"\s*:\s*"[^"]*\.env[^"]*"'; then
  echo "安全策略：.env 文件包含敏感信息（API key 等），禁止读取" >&2
  exit 1
fi

exit 0
