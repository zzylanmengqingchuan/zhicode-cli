import { TavilySearch } from '@langchain/tavily';

/**
 * web_search 工具的具体实现（纯函数，方便单元测试）
 * 使用 Tavily 进行真实的联网搜索，需要环境变量 TAVILY_API_KEY
 */
export async function webSearch(query: string): Promise<string> {
  if (!process.env.TAVILY_API_KEY) {
    return '未配置 TAVILY_API_KEY，无法使用联网搜索。请在 .env 中设置后重试。';
  }

  const tavily = new TavilySearch({
    maxResults: 3,
    topic: 'general',
  });

  const result = await tavily.invoke({ query });
  return typeof result === 'string' ? result : JSON.stringify(result);
}
