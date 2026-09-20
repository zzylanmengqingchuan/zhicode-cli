/**
 * 上下文 token 统计：动态查询模型上限 + 格式化用量展示
 */

const limitCache = new Map<string, number | null>();

/**
 * 从模型服务方的 /models 接口动态查询模型的最大上下文 token 数
 * 结果按模型名缓存；查询失败返回 null（不影响主流程）
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
