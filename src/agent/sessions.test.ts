import * as fs from 'node:fs';
import * as path from 'node:path';
import Database from 'better-sqlite3';
import { formatRelativeTime, listSessions, sessionExists } from './sessions';

const TMP_DIR = path.join(process.cwd(), 'tmp-sessions-test');
const TEST_DB = path.join(TMP_DIR, 'sessions-test.db');

function humanMsg(content: string) {
  return {
    lc: 1,
    type: 'constructor',
    id: ['langchain_core', 'messages', 'HumanMessage'],
    kwargs: { content },
  };
}

function aiMsg(content: string) {
  return {
    lc: 1,
    type: 'constructor',
    id: ['langchain_core', 'messages', 'AIMessage'],
    kwargs: { content },
  };
}

function checkpoint(ts: string, messages: ReturnType<typeof humanMsg>[]) {
  return JSON.stringify({ v: 4, ts, channel_values: { messages } });
}

beforeAll(() => {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const db = new Database(TEST_DB);
  db.exec(`CREATE TABLE checkpoints (
    thread_id TEXT NOT NULL,
    checkpoint_ns TEXT NOT NULL DEFAULT '',
    checkpoint_id TEXT NOT NULL,
    parent_checkpoint_id TEXT,
    type TEXT,
    checkpoint BLOB,
    metadata BLOB,
    PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
  )`);
  const insert = db.prepare(
    'INSERT INTO checkpoints (thread_id, checkpoint_id, checkpoint) VALUES (?, ?, ?)',
  );
  // thread-A：两条，较旧
  insert.run('thread-A', '1f000000-0000-6000-8000-000000000001',
    checkpoint('2026-09-20T08:00:00.000Z', [humanMsg('A 的第一个问题'), aiMsg('回答 1')]));
  insert.run('thread-A', '1f000000-0000-6000-8000-000000000002',
    checkpoint('2026-09-20T08:05:00.000Z', [
      humanMsg('A 的第一个问题'),
      aiMsg('回答 1'),
      humanMsg('A 的最后一个问题'),
    ]));
  // thread-B：一条，较新
  insert.run('thread-B', '1f000000-0000-6000-8000-000000000010',
    checkpoint('2026-09-20T09:00:00.000Z', [humanMsg('B 的唯一问题')]));
  db.close();
});

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

describe('listSessions', () => {
  it('每个 thread 取最新检查点，按时间逆序', () => {
    const sessions = listSessions(20, TEST_DB);
    expect(sessions.map((s) => s.threadId)).toEqual(['thread-B', 'thread-A']);
  });

  it('取每个会话最后的用户输入', () => {
    const sessions = listSessions(20, TEST_DB);
    const a = sessions.find((s) => s.threadId === 'thread-A')!;
    expect(a.lastQuestion).toBe('A 的最后一个问题');
    expect(a.lastActiveAt.toISOString()).toBe('2026-09-20T08:05:00.000Z');
  });

  it('超过 50 字的问题会被截断', () => {
    const db = new Database(TEST_DB);
    db.prepare(
      'INSERT INTO checkpoints (thread_id, checkpoint_id, checkpoint) VALUES (?, ?, ?)',
    ).run('thread-long', '1f000000-0000-6000-8000-000000000020',
      checkpoint('2026-09-20T10:00:00.000Z', [humanMsg('长'.repeat(100))]));
    db.close();
    const sessions = listSessions(20, TEST_DB);
    const long = sessions.find((s) => s.threadId === 'thread-long')!;
    expect(long.lastQuestion.length).toBe(51); // 50 字 + 省略号
    expect(long.lastQuestion.endsWith('…')).toBe(true);
  });

  it('数据库文件不存在时返回空数组', () => {
    expect(listSessions(20, path.join(TMP_DIR, 'no-such.db'))).toEqual([]);
  });
});

describe('sessionExists', () => {
  it('存在的 thread_id 返回 true', () => {
    expect(sessionExists('thread-A', TEST_DB)).toBe(true);
  });

  it('不存在的 thread_id 返回 false', () => {
    expect(sessionExists('thread-xyz', TEST_DB)).toBe(false);
  });

  it('数据库文件不存在时返回 false', () => {
    expect(sessionExists('thread-A', path.join(TMP_DIR, 'no-such.db'))).toBe(false);
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-09-20T12:00:00.000Z');

  it('不到 1 分钟显示刚刚', () => {
    expect(formatRelativeTime(new Date('2026-09-20T11:59:30.000Z'), now)).toBe('刚刚');
  });

  it('分钟级', () => {
    expect(formatRelativeTime(new Date('2026-09-20T11:55:00.000Z'), now)).toBe('5 分钟前');
  });

  it('小时级', () => {
    expect(formatRelativeTime(new Date('2026-09-20T09:00:00.000Z'), now)).toBe('3 小时前');
  });

  it('天级', () => {
    expect(formatRelativeTime(new Date('2026-09-18T12:00:00.000Z'), now)).toBe('2 天前');
  });

  it('超过一周显示具体日期', () => {
    expect(formatRelativeTime(new Date('2026-09-01T08:30:00.000Z'), now)).toContain('2026-09-01');
  });
});
