import * as fs from 'node:fs';
import { ChatOpenAI } from '@langchain/openai';
import { CONFIG_PATH, loadConfig } from './config.js';

export interface ModelConfig {
  model: string;
  apiKey: string;
  baseURL: string;
}

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

  const raw = loadConfig(configPath);
  if (!raw) {
    throw new Error(`配置文件 ${configPath} 不是合法的 JSON，请修正。参考格式：\n${CONFIG_EXAMPLE}`);
  }

  const model = raw.model;
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

const CONFIG_DOC = 'https://github.com/zzylanmengqingchuan/zhicode-cli';

/**
 * 启动时验证模型配置是否可用：
 * - apiKey 不存在 → 抛出错误，友好提示（拦截启动）
 * - apiKey 过短（< 20）→ 发送一个最简单的 API 请求验证；失败也抛出友好错误
 * - apiKey 足够长 → 跳过验证（避免每次启动的额外消耗）
 */
export async function checkModel(modelConfig: ModelConfig = loadModelConfig()): Promise<void> {
  if (!modelConfig.apiKey) {
    throw new Error(
      `未配置模型 API Key，请编辑 ${CONFIG_PATH} 填入 apiKey。\n配置文档: ${CONFIG_DOC}`,
    );
  }
  if (modelConfig.apiKey.length < 20) {
    try {
      await model.invoke([{ role: 'user', content: 'hi' }]);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(
        `模型 API Key 验证失败（${modelConfig.model} @ ${modelConfig.baseURL}）: ${detail}\n请检查 ${CONFIG_PATH} 中的配置是否正确。\n配置文档: ${CONFIG_DOC}`,
      );
    }
  }
}
