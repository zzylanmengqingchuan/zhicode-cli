import * as fs from 'node:fs';
import * as path from 'node:path';
import Database from 'better-sqlite3';

export interface SessionInfo {
  threadId: string;
  lastQuestion: string;
  lastActiveAt: Date;
}

const DB_PATH = path.resolve(process.cwd(), '.data', 'checkpointer.db');

const MAX_QUESTION_LEN = 50;

interface SerializedMessage {
  id?: string[];
  kwargs?: { content?: unknown };
}

function lastUserQuestion(checkpointJson: string): string {
  const checkpoint = JSON.parse(checkpointJson) as {
    channel_values?: { messages?: SerializedMessage[] };
  };
  const messages = checkpoint.channel_values?.messages ?? [];
  const lastHuman = [...messages]
    .reverse()
    .find((m) => m.id?.some((part) => part === 'HumanMessage'));
  if (!lastHuman) return '(无用户输入)';
  const content = lastHuman.kwargs?.content;
  const text = typeof content === 'string' ? content : JSON.stringify(content);
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > MAX_QUESTION_LEN ? `${oneLine.slice(0, MAX_QUESTION_LEN)}…` : oneLine;
}

/**
 * 列出最近的会话（每个 thread_id 取最新检查点），按时间逆序
 * 只读查询数据库，不访问 LLM
 */
export function listSessions(limit = 20, dbPath: string = DB_PATH): SessionInfo[] {
  if (!fs.existsSync(dbPath)) return [];

  const db = new Database(dbPath, { readonly: true });
  try {
    const rows = db
      .prepare(
        `SELECT thread_id, checkpoint FROM checkpoints
         WHERE (thread_id, checkpoint_id) IN (
           SELECT thread_id, MAX(checkpoint_id) FROM checkpoints GROUP BY thread_id
         )
         ORDER BY checkpoint_id DESC
         LIMIT ?`,
      )
      .all(limit) as { thread_id: string; checkpoint: string }[];

    return rows.map((row) => {
      const checkpoint = JSON.parse(row.checkpoint) as { ts?: string };
      return {
        threadId: row.thread_id,
        lastQuestion: lastUserQuestion(row.checkpoint),
        lastActiveAt: checkpoint.ts ? new Date(checkpoint.ts) : new Date(0),
      };
    });
  } finally {
    db.close();
  }
}

/**
 * 检查某个 thread_id 在数据库中是否存在（只读查询，不访问 LLM）
 */
export function sessionExists(threadId: string, dbPath: string = DB_PATH): boolean {
  if (!fs.existsSync(dbPath)) return false;
  const db = new Database(dbPath, { readonly: true });
  try {
    const row = db
      .prepare('SELECT 1 FROM checkpoints WHERE thread_id = ? LIMIT 1')
      .get(threadId);
    return row !== undefined;
  } finally {
    db.close();
  }
}

/**
 * 简洁的相对时间：刚刚 / N 分钟前 / N 小时前 / N 天前 / 具体日期
 */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
