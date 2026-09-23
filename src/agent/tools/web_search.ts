import { TavilySearch } from '@langchain/tavily';
import { getEnvValue } from '../config.js';

/**
 * web_search 工具的具体实现（纯函数，方便单元测试）
 * 使用 Tavily 进行真实的联网搜索
 * TAVILY_API_KEY 配置在 ~/.zhiwen/zhiwen.json 的 env 区（回退到进程环境变量）
 */
export async function webSearch(query: string): Promise<string> {
  if (!getEnvValue('TAVILY_API_KEY')) {
    return '未配置 TAVILY_API_KEY，无法使用联网搜索。请在 ~/.zhiwen/zhiwen.json 的 env 区设置后重试。';
  }

  const tavily = new TavilySearch({
    maxResults: 3,
    topic: 'general',
    tavilyApiKey: getEnvValue('TAVILY_API_KEY'),
  });

  const result = await tavily.invoke({ query });
  return typeof result === 'string' ? result : JSON.stringify(result);
}
