import * as fs from 'node:fs';
import * as path from 'node:path';
import Database from 'better-sqlite3';
import { createMemory } from './memory_create';
import { memoryCreateTool, tools } from '../tools';

const TMP_DIR = path.join(process.cwd(), 'tmp-memory-create-test');
const TEST_DB = path.join(TMP_DIR, 'test.db');

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

describe('createMemory 实现', () => {
  it('能写入一条完整记忆', () => {
    const msg = createMemory(
      {
        type: 'preference',
        content: '用户喜欢喝咖啡',
        keywords: ['咖啡', '饮品'],
        importance: 4,
        sessionId: 'thread-test',
      },
      TEST_DB,
    );
    expect(msg).toContain('记忆已存储');

    const db = new Database(TEST_DB, { readonly: true });
    const row = db
      .prepare('SELECT * FROM memory WHERE session_id = ?')
      .get('thread-test') as {
      type: string;
      content: string;
      keywords: string;
      importance: number;
    };
    db.close();
    expect(row.type).toBe('preference');
    expect(row.content).toBe('用户喜欢喝咖啡');
    expect(JSON.parse(row.keywords)).toEqual(['咖啡', '饮品']);
    expect(row.importance).toBe(4);
  });

  it('缺省参数使用默认值（importance=3，keywords=[]）', () => {
    createMemory({ type: 'fact', content: '用户是前端工程师' }, TEST_DB);
    const db = new Database(TEST_DB, { readonly: true });
    const row = db
      .prepare('SELECT keywords, importance FROM memory WHERE content = ?')
      .get('用户是前端工程师') as { keywords: string; importance: number };
    db.close();
    expect(JSON.parse(row.keywords)).toEqual([]);
    expect(row.importance).toBe(3);
  });

  it('非法类型报错', () => {
    expect(() =>
      createMemory({ type: 'invalid' as never, content: 'x' }, TEST_DB),
    ).toThrow('无效的记忆类型');
  });

  it('importance 超出 1~5 报错', () => {
    expect(() =>
      createMemory({ type: 'fact', content: 'x', importance: 9 }, TEST_DB),
    ).toThrow('importance 必须在 1~5 之间');
  });
});

describe('memory_create 工具注册', () => {
  it('元信息正确', () => {
    expect(memoryCreateTool.name).toBe('memory_create');
    expect(memoryCreateTool.description).toContain('记忆');
  });

  it('已加入 tools 数组', () => {
    expect(tools).toContain(memoryCreateTool);
  });
});
