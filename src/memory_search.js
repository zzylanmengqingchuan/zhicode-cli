// 临时验证脚本：测试 memory_fts 全文检索 SQL（不提交到 git）
// 用法：node src/memory_search.js
const Database = require('better-sqlite3');
const path = require('node:path');

const DB_PATH = path.resolve(process.cwd(), '.data', 'checkpointer.db');
const db = new Database(DB_PATH, { readonly: true });

const SQL = `
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
  WHERE memory_fts MATCH '水果 OR 偏好'
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

const rows = db.prepare(SQL).all();
console.log(`命中 ${rows.length} 条：\n`);
for (const r of rows) {
  console.log(`id=${r.id} type=${r.type} importance=${r.importance} final_score=${r.final_score.toFixed(3)}`);
  console.log(`  content: ${r.content}`);
  console.log(`  keywords: ${r.keywords}`);
  console.log(`  (relevance=${r.relevance_score.toFixed(2)}, importance=${r.importance_score}, time=${r.time_score.toFixed(4)})\n`);
}
db.close();
