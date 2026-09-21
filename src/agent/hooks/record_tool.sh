#!/bin/bash
# PostToolUse hook: 记录每次工具调用的 name 和 args 到 tools.log
# 上下文通过环境变量传入：TOOL_NAME / TOOL_ARGS

echo "$(date '+%Y-%m-%d %H:%M:%S') | $TOOL_NAME | $TOOL_ARGS" >> tools.log
exit 0
