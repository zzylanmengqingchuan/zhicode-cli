/**
 * 上下文 token 统计：动态查询模型上限 + 静态兜底表 + 格式化用量展示
 */

/**
 * 各供应商常用模型的上下文上限兜底表（动态查询失败时使用）
 * 数据来源：各厂商官方文档（2026-09）
 */
export const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  // Moonshot / Kimi
  'kimi-k2.6': 262144,
  'moonshot-v1-8k': 8192,
  'moonshot-v1-32k': 32768,
  'moonshot-v1-128k': 131072,

  // DeepSeek（V3.1 起均为 128K）
  'deepseek-chat': 131072,
  'deepseek-reasoner': 131072,

  // MiniMax
  'MiniMax-M2': 196608,
  'MiniMax-M2.5': 204800,
  'MiniMax-Text-01': 1000000,

  // 智谱 GLM
  'glm-4.6': 204800,
  'glm-4.5': 131072,
  'glm-4.5-air': 131072,
  'glm-4-plus': 131072,
  'glm-4': 131072,

  // 阿里百炼 Qwen
  'qwen-max': 32768,
  'qwen3-max': 262144,
  'qwen-plus': 997952,
  'qwen-turbo': 1000000,
  'qwen-flash': 995904,

  // 小米 MiMo
  'mimo-v2-pro': 1048576,
  'mimo-v2.5-pro': 1048576,
  'mimo-v2.6-pro': 1048576,
  'mimo-v2-omni': 262144,
};

/**
 * 在兜底表中查找模型上限：先精确匹配，再按前缀匹配（兼容 qwen3-max-2025-09-23 这类快照名）
 */
export function lookupContextLimit(model: string): number | null {
  if (MODEL_CONTEXT_LIMITS[model]) return MODEL_CONTEXT_LIMITS[model];
  const hit = Object.keys(MODEL_CONTEXT_LIMITS)
    .filter((key) => model.startsWith(key) || key.startsWith(model))
    .sort((a, b) => b.length - a.length)[0];
  return hit ? MODEL_CONTEXT_LIMITS[hit] : null;
}

const limitCache = new Map<string, number | null>();

/**
 * 模型的最大上下文 token 数：
 * 先动态查询模型服务方的 /models 接口（带缓存），查不到再用静态兜底表
 */
export async function getModelContextLimit(
  model: string,
  apiKey: string | undefined,
  baseURL: string,
): Promise<number | null> {
  if (limitCache.has(model)) return limitCache.get(model) ?? null;

  let limit: number | null = null;
  try {
    const res = await fetch(`${baseURL}/models`, {
      headers: { Authorization: `Bearer ${apiKey ?? ''}` },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        data?: { id: string; context_length?: number }[];
      };
      limit = data.data?.find((m) => m.id === model)?.context_length ?? null;
    }
  } catch {
    limit = null;
  }

  // 动态查询失败时回退到静态表
  limit ??= lookupContextLimit(model);
  limitCache.set(model, limit);
  return limit;
}

/**
 * 上下文用量是否接近上限（>= 80%）；任一值未知时不告警
 */
export function isContextNearLimit(used: number | null, max: number | null): boolean {
  if (used === null || max === null || max <= 0) return false;
  return used / max >= 0.8;
}

/**
 * 格式化上下文用量：当前 token / 模型上限（占比）
 */
export function formatContextUsage(used: number | null, max: number | null): string {
  const usedText = used === null ? '未知' : used.toLocaleString('en-US');
  if (max === null) return `上下文: ${usedText} tokens（上限未知）`;
  const pct = (((used ?? 0) / max) * 100).toFixed(1);
  return `上下文: ${usedText} / ${max.toLocaleString('en-US')} tokens（${pct}%）`;
}
