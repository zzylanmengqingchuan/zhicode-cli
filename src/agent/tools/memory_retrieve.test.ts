import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildMatchQuery, retrieveMemories } from './memory_retrieve';
import { createMemory } from './memory_create';
import { memoryRetrieveTool, tools } from '../tools';

const TMP_DIR = path.join(process.cwd(), 'tmp-memory-retrieve-test');
const TEST_DB = path.join(TMP_DIR, 'test.db');

beforeAll(() => {
  createMemory(
    { type: 'preference', content: '用户喜欢的水果是苹果', keywords: ['水果', '偏好', '苹果'], importance: 5 },
    TEST_DB,
  );
  createMemory(
    { type: 'fact', content: '水果店新到了橙子', keywords: ['水果', '橙子'], importance: 2 },
    TEST_DB,
  );
  createMemory(
    { type: 'preference', content: '用户喝咖啡只喝美式', keywords: ['咖啡', '偏好'], importance: 3 },
    TEST_DB,
  );
});

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

describe('buildMatchQuery', () => {
  it('关键词用引号包裹并以 OR 连接', () => {
    expect(buildMatchQuery(['水果', '偏好'])).toBe('"水果" OR "偏好"');
  });

  it('转义关键词中的双引号', () => {
    expect(buildMatchQuery(['say "hi"'])).toBe('"say ""hi"""');
  });
});

describe('retrieveMemories 实现', () => {
  it('双关键词命中的记录排在最前', () => {
    const result = retrieveMemories(['水果', '偏好'], TEST_DB);
    expect(result).toContain('检索到');
    const firstLine = result.split('\n')[1];
    expect(firstLine).toContain('用户喜欢的水果是苹果');
  });

  it('单关键词也能检索', () => {
    const result = retrieveMemories(['咖啡'], TEST_DB);
    expect(result).toContain('美式');
  });

  it('没有命中时给出提示', () => {
    expect(retrieveMemories(['不存在的关键词xyz'], TEST_DB)).toContain('没有找到');
  });

  it('空关键词时提示无法检索', () => {
    expect(retrieveMemories([], TEST_DB)).toContain('未提供关键词');
  });
});

describe('memory_retrieve 工具注册', () => {
  it('元信息正确', () => {
    expect(memoryRetrieveTool.name).toBe('memory_retrieve');
    expect(memoryRetrieveTool.description).toContain('检索');
  });

  it('已加入 tools 数组', () => {
    expect(tools).toContain(memoryRetrieveTool);
  });
});
