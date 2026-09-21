import Database from 'better-sqlite3';
import { DB_PATH, initDb } from '../db.js';

export const MEMORY_TYPES = ['fact', 'event', 'preference', 'skill'] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

export interface MemoryInput {
  type: MemoryType;
  content: string;
  keywords?: string[];
  importance?: number;
  sessionId?: string;
}

/**
 * memory_create 工具的具体实现（纯函数，方便单元测试）
 * 把一条记忆写入 sqlite 的 memory 表
 */
export function createMemory(input: MemoryInput, dbPath: string = DB_PATH): string {
  if (!MEMORY_TYPES.includes(input.type)) {
    throw new Error(`无效的记忆类型: ${input.type}，可选: ${MEMORY_TYPES.join(' / ')}`);
  }
  const importance = input.importance ?? 3;
  if (importance < 1 || importance > 5) {
    throw new Error(`importance 必须在 1~5 之间，收到: ${importance}`);
  }

  initDb(dbPath); // 确保表存在
  const db = new Database(dbPath);
  try {
    const result = db
      .prepare(
        'INSERT INTO memory (type, content, keywords, importance, session_id) VALUES (?, ?, ?, ?, ?)',
      )
      .run(
        input.type,
        input.content,
        JSON.stringify(input.keywords ?? []),
        importance,
        input.sessionId ?? null,
      );
    return `记忆已存储（id: ${result.lastInsertRowid}，类型: ${input.type}）`;
  } finally {
    db.close();
  }
}
