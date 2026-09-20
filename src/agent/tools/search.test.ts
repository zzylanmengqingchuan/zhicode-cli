import { search } from './search';

describe('search tool', () => {
  it('查询包含 sf 时返回旧金山雾天', async () => {
    const result = await search.invoke({ query: 'sf weather' });
    expect(result).toBe("It's 60 degrees and foggy.");
  });

  it('查询包含 san francisco（不区分大小写）时返回雾天', async () => {
    const result = await search.invoke({ query: 'San Francisco today' });
    expect(result).toBe("It's 60 degrees and foggy.");
  });

  it('查询其他城市时返回晴天', async () => {
    const result = await search.invoke({ query: 'beijing weather' });
    expect(result).toBe("It's 90 degrees and sunny.");
  });

  it('工具的元信息正确', () => {
    expect(search.name).toBe('search');
    expect(search.description).toBe('Call to surf the web.');
  });
});
