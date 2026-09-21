import * as fs from 'node:fs';
import * as path from 'node:path';
import Database from 'better-sqlite3';
import { initDb } from './db';

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
