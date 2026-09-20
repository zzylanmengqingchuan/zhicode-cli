import { searchWeb } from './search';
import { search, tools } from '../tools';

describe('searchWeb 实现', () => {
  it('查询包含 sf 时返回旧金山雾天', async () => {
    expect(await searchWeb('sf weather')).toBe("It's 60 degrees and foggy.");
  });

  it('查询包含 san francisco（不区分大小写）时返回雾天', async () => {
    expect(await searchWeb('San Francisco today')).toBe("It's 60 degrees and foggy.");
  });

  it('查询其他城市时返回晴天', async () => {
    expect(await searchWeb('beijing weather')).toBe("It's 90 degrees and sunny.");
  });
});

describe('tools 注册中心', () => {
  it('search 工具的元信息正确', () => {
    expect(search.name).toBe('search');
    expect(search.description).toBe('Call to surf the web.');
  });

  it('tools 数组包含 search', () => {
    expect(tools).toContain(search);
  });
});
