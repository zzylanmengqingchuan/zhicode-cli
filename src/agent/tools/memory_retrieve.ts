import Database from 'better-sqlite3';
import { DB_PATH, initDb } from '../db.js';

export interface MemoryRecord {
  id: number;
  type: string;
  content: string;
  keywords: string;
  importance: number;
  final_score: number;
}

/** 三因子排序 SQL：BM25 相关性 ×0.6 + importance ×0.3 + 时间衰减 ×0.1 */
const SEARCH_SQL = `
WITH ranked AS (
  SELECT
    m.*,
    -bm25(memory_fts, 10.0, 5.0) AS relevance_score,
    (m.importance * 0.3) AS importance_score,
    (
      1.0 / (
        1.0 +
        ((strftime('%s','now') - strftime('%s', m.updated_at)) / 86400.0)
      )
    ) AS time_score
  FROM memory_fts
  JOIN memory m ON m.id = memory_fts.rowid
  WHERE memory_fts MATCH ?
)
SELECT *,
(
  relevance_score * 0.6 +
  importance_score * 0.3 +
  time_score * 0.1
) AS final_score
FROM ranked
ORDER BY final_score DESC
LIMIT 10;
`;

/** 把关键词数组转成 FTS5 MATCH 查询：每个词加引号防注入，OR 连接 */
export function buildMatchQuery(keywords: string[]): string {
  return keywords
    .map((k) => `"${k.replace(/"/g, '""')}"`)
    .join(' OR ');
}

/**
 * memory_retrieve 工具的具体实现（纯函数，方便单元测试）
 * 用关键词在 memory_fts 全文检索，按 相关性+重要度+时间 综合排序，取前 10 条
 */
export function retrieveMemories(
  keywords: string[],
  dbPath: string = DB_PATH,
): string {
  if (keywords.length === 0) {
    return '未提供关键词，无法检索记忆';
  }

  initDb(dbPath);
  const db = new Database(dbPath, { readonly: true });
  let rows: MemoryRecord[];
  try {
    rows = db.prepare(SEARCH_SQL).all(buildMatchQuery(keywords)) as MemoryRecord[];
  } catch (err) {
    return `检索失败: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    db.close();
  }

  if (rows.length === 0) {
    return `没有找到与「${keywords.join('、')}」相关的记忆`;
  }

  const lines = rows.map(
    (r, i) =>
      `${i + 1}. [${r.type}] ${r.content}（id: ${r.id}，重要度 ${r.importance}，相关度 ${r.final_score.toFixed(2)}）`,
  );
  return `检索到 ${rows.length} 条相关记忆：\n${lines.join('\n')}`;
}
