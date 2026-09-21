import * as fs from 'node:fs';
import * as path from 'node:path';
import Database from 'better-sqlite3';
import { createMemory } from './memory_create';
import { deleteMemory } from './memory_delete';
import { retrieveMemories } from './memory_retrieve';
import { memoryDeleteTool, tools } from '../tools';

const TMP_DIR = path.join(process.cwd(), 'tmp-memory-delete-test');
const TEST_DB = path.join(TMP_DIR, 'test.db');

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

describe('deleteMemory 实现', () => {
  it('删除存在的记忆，FTS 索引同步删除', () => {
    createMemory(
      { type: 'fact', content: '用户养了一只叫年糕的猫', keywords: ['猫', '年糕'] },
      TEST_DB,
    );
    expect(retrieveMemories(['年糕'], TEST_DB)).toContain('年糕');

    const db = new Database(TEST_DB, { readonly: true });
    const row = db.prepare("SELECT id FROM memory WHERE content LIKE '%年糕%'").get() as {
      id: number;
    };
    db.close();

    expect(deleteMemory(row.id, TEST_DB)).toContain('记忆已删除');

    // 主表和 FTS 都查不到了
    expect(retrieveMemories(['年糕'], TEST_DB)).toContain('没有找到');
  });

  it('删除不存在的 id 时提示', () => {
    expect(deleteMemory(99999, TEST_DB)).toContain('记忆不存在');
  });
});

describe('memory_delete 工具注册', () => {
  it('元信息正确', () => {
    expect(memoryDeleteTool.name).toBe('memory_delete');
    expect(memoryDeleteTool.description).toContain('删除');
  });

  it('已加入 tools 数组', () => {
    expect(tools).toContain(memoryDeleteTool);
  });
});
