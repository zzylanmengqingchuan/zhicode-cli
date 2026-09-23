import * as fs from 'node:fs';
import * as path from 'node:path';
import { DATA_DIR } from '../config.js';

/** 用户画像文件：~/.zhiwen/.data/profile.md */
const PROFILE_PATH = path.join(DATA_DIR, 'profile.md');

/**
 * profile_update 工具的具体实现（纯函数，方便单元测试）
 * 全量更新用户画像文件；更新前把旧文件备份为 profile.<时间戳>-<随机串>.md，防止失误丢数据
 */
export function updateProfile(content: string, profilePath: string = PROFILE_PATH): string {
  const dir = path.dirname(profilePath);
  fs.mkdirSync(dir, { recursive: true });

  let backupPath: string | null = null;
  if (fs.existsSync(profilePath)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rand = Math.random().toString(36).slice(2, 8);
    backupPath = path.join(dir, `profile.${stamp}-${rand}.md`);
    fs.copyFileSync(profilePath, backupPath);
  }

  fs.writeFileSync(profilePath, content, 'utf-8');

  return backupPath
    ? `profile 已更新（旧版本已备份到 ${path.basename(backupPath)}）`
    : 'profile 已创建';
}
