import * as fs from 'node:fs';
import * as path from 'node:path';
import Database from 'better-sqlite3';
import { DATA_DIR } from './config.js';

/** sqlite 数据库文件（~/.zhiwen/.data/ 下，全局共享） */
export const DB_PATH = path.join(DATA_DIR, 'checkpointer.db');

/**
 * 启动时初始化数据表；表已存在则跳过（IF NOT EXISTS）
 */
export function initDb(dbPath: string = DB_PATH): void {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,              -- 'fact' | 'event' | 'preference' | 'skill'
        content TEXT NOT NULL,           -- 自然语言描述，方便拼进 prompt
        keywords TEXT,                   -- JSON array，用于关键词检索
        importance INTEGER DEFAULT 3,    -- 1~5，影响召回优先级和淘汰策略
        session_id TEXT,                 -- langGraph 当前对话的 thread_id
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 全文检索表：只存索引不复制原文（content='memory' 外部内容模式），查询时 JOIN 回主表
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
        content,
        keywords,
        content='memory', content_rowid='id'
      )
    `);

    // 触发器：主表增删改时自动同步 FTS 索引
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS memory_ai AFTER INSERT ON memory BEGIN
        INSERT INTO memory_fts(rowid, content, keywords)
        VALUES (new.id, new.content, new.keywords);
      END;
      CREATE TRIGGER IF NOT EXISTS memory_ad AFTER DELETE ON memory BEGIN
        INSERT INTO memory_fts(memory_fts, rowid, content, keywords)
        VALUES ('delete', old.id, old.content, old.keywords);
      END;
      CREATE TRIGGER IF NOT EXISTS memory_au AFTER UPDATE ON memory BEGIN
        INSERT INTO memory_fts(memory_fts, rowid, content, keywords)
        VALUES ('delete', old.id, old.content, old.keywords);
        INSERT INTO memory_fts(rowid, content, keywords)
        VALUES (new.id, new.content, new.keywords);
      END;
    `);

    // 为建表之前的存量数据重建索引（重复执行无害：先清空再重建）
    db.exec("INSERT INTO memory_fts(memory_fts) VALUES('rebuild')");
  } finally {
    db.close();
  }
}
