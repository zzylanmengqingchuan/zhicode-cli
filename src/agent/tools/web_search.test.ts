import { config as loadEnv } from 'dotenv';
import { webSearch } from './web_search';
import { webSearchTool, tools } from '../tools';

// 测试真实搜索需要 .env 里的 TAVILY_API_KEY
loadEnv({ quiet: true });

describe('webSearch 实现', () => {
  it('未配置 API key 时给出明确提示', async () => {
    const original = process.env.TAVILY_API_KEY;
    delete process.env.TAVILY_API_KEY;
    try {
      expect(await webSearch('hello')).toContain('未配置 TAVILY_API_KEY');
    } finally {
      process.env.TAVILY_API_KEY = original;
    }
  });

  // 真实调用 Tavily API（需要有效的 TAVILY_API_KEY，否则跳过）
  const itWithKey = process.env.TAVILY_API_KEY ? it : it.skip;
  itWithKey(
    '能返回真实的搜索结果',
    async () => {
      const result = await webSearch('OpenAI latest news');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    },
    30000,
  );
});

describe('web_search 工具注册', () => {
  it('元信息正确', () => {
    expect(webSearchTool.name).toBe('web_search');
    expect(webSearchTool.description).toContain('搜索');
  });

  it('已加入 tools 数组', () => {
    expect(tools).toContain(webSearchTool);
  });
});
