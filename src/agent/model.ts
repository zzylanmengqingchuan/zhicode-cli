import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ChatOpenAI } from '@langchain/openai';

export interface ModelConfig {
  model: string;
  apiKey: string;
  baseURL: string;
}

/** 用户级配置文件：~/.zhiwen/zhiwen.json（跨平台：os.homedir() 兼容 Win/Mac/Linux） */
export const CONFIG_PATH = path.join(os.homedir(), '.zhiwen', 'zhiwen.json');

const CONFIG_EXAMPLE = `{
  "model": {
    "model": "kimi-k2.6",
    "apiKey": "你的 API Key",
    "baseURL": "https://api.moonshot.cn/v1"
  }
}`;

/**
 * 从 ~/.zhiwen/zhiwen.json 读取模型配置。
 * 文件不存在、格式错误、或缺少 model 必填字段时，报错并提示用户如何配置。
 */
export function loadModelConfig(configPath: string = CONFIG_PATH): ModelConfig {
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `未找到模型配置文件: ${configPath}\n请创建该文件，内容格式如下：\n${CONFIG_EXAMPLE}`,
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    throw new Error(`配置文件 ${configPath} 不是合法的 JSON，请修正。参考格式：\n${CONFIG_EXAMPLE}`);
  }

  const model = (raw as { model?: Partial<ModelConfig> } | null)?.model;
  const missing = (['model', 'apiKey', 'baseURL'] as const).filter((k) => !model?.[k]);
  if (!model || missing.length > 0) {
    throw new Error(
      `配置文件 ${configPath} 缺少 model 配置的必填字段: ${missing.join(', ')}。参考格式：\n${CONFIG_EXAMPLE}`,
    );
  }

  return model as ModelConfig;
}

// 模块加载时读取配置并创建模型
const config = loadModelConfig();

export const MODEL_NAME = config.model;
export const MODEL_BASE_URL = config.baseURL;

export const model = new ChatOpenAI({
  model: config.model,
  apiKey: config.apiKey,
  configuration: {
    baseURL: config.baseURL,
  },
  streaming: true,
});
