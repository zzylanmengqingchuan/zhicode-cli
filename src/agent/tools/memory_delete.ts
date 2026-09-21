import Database from 'better-sqlite3';
import { DB_PATH, initDb } from '../db.js';

/**
 * memory_delete 工具的具体实现（纯函数，方便单元测试）
 * 按 id 从 memory 表删除一条记忆；memory_fts 索引由触发器自动同步删除
 */
export function deleteMemory(id: number, dbPath: string = DB_PATH): string {
  initDb(dbPath);
  const db = new Database(dbPath);
  try {
    const result = db.prepare('DELETE FROM memory WHERE id = ?').run(id);
    if (result.changes === 0) {
      return `记忆不存在（id: ${id}），可能已被删除`;
    }
    return `记忆已删除（id: ${id}）`;
  } finally {
    db.close();
  }
}
