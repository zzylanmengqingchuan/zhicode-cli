import * as fs from 'node:fs';
import * as path from 'node:path';
import Database from 'better-sqlite3';
import { initDb, invalidateRecentMemoriesCache, listRecentMemories } from './db';
import { createMemory } from './tools/memory_create';
import { deleteMemory } from './tools/memory_delete';

const TMP_DIR = path.join(process.cwd(), 'tmp-db-test');
const TEST_DB = path.join(TMP_DIR, 'test.db');

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

describe('initDb', () => {
  it('创建 memory 表', () => {
    initDb(TEST_DB);
    const db = new Database(TEST_DB, { readonly: true });
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='memory'")
      .all();
    db.close();
    expect(tables.length).toBe(1);
  });

  it('重复调用不报错（表已存在则跳过）', () => {
    initDb(TEST_DB);
    expect(() => initDb(TEST_DB)).not.toThrow();
  });

  it('memory 表可以插入和查询数据', () => {
    initDb(TEST_DB);
    const db = new Database(TEST_DB);
    db.prepare(
      "INSERT INTO memory (type, content, keywords, importance, session_id) VALUES (?, ?, ?, ?, ?)",
    ).run('preference', '用户喜欢 TypeScript', '["typescript","前端"]', 4, 'thread-1');
    const row = db
      .prepare('SELECT * FROM memory WHERE session_id = ?')
      .get('thread-1') as { type: string; content: string; importance: number };
    db.close();
    expect(row.type).toBe('preference');
    expect(row.content).toBe('用户喜欢 TypeScript');
    expect(row.importance).toBe(4);
  });
});

describe('listRecentMemories', () => {
  const RECENT_DB = path.join(TMP_DIR, 'recent.db');

  it('按时间逆序返回，遵守 limit', () => {
    invalidateRecentMemoriesCache();
    createMemory({ type: 'fact', content: '第一条记忆' }, RECENT_DB);
    createMemory({ type: 'event', content: '第二条记忆' }, RECENT_DB);
    createMemory({ type: 'preference', content: '第三条记忆' }, RECENT_DB);

    const all = listRecentMemories(10, RECENT_DB);
    expect(all.length).toBe(3);
    expect(all[0].content).toBe('第三条记忆');

    const limited = listRecentMemories(2, RECENT_DB);
    expect(limited.length).toBe(2);
    expect(limited[0].content).toBe('第三条记忆');
  });

  it('带缓存：连续调用返回同一结果；create/delete 后缓存失效', () => {
    invalidateRecentMemoriesCache();
    const before = listRecentMemories(10, RECENT_DB);
    const count = before.length;

    // 写入新记忆（createMemory 内部会失效缓存）
    createMemory({ type: 'fact', content: '刚写入的记忆' }, RECENT_DB);
    const after = listRecentMemories(10, RECENT_DB);
    expect(after.length).toBe(count + 1);
    expect(after[0].content).toBe('刚写入的记忆');

    // 删除该记忆（deleteMemory 内部会失效缓存）
    deleteMemory(after[0].id, RECENT_DB);
    const final = listRecentMemories(10, RECENT_DB);
    expect(final.length).toBe(count);
  });

  it('数据库为空时返回空数组', () => {
    invalidateRecentMemoriesCache();
    expect(listRecentMemories(10, path.join(TMP_DIR, 'empty.db'))).toEqual([]);
  });
});
