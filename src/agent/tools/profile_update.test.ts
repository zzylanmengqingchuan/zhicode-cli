import * as fs from 'node:fs';
import * as path from 'node:path';
import { updateProfile } from './profile_update';
import { profileUpdateTool, tools } from '../tools';

const TMP_DIR = path.join(process.cwd(), 'tmp-profile-test');
const PROFILE_FILE = path.join(TMP_DIR, 'profile.md');

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

describe('updateProfile 实现', () => {
  it('文件不存在时直接创建', () => {
    const msg = updateProfile('姓名：小赵', PROFILE_FILE);
    expect(msg).toBe('profile 已创建');
    expect(fs.readFileSync(PROFILE_FILE, 'utf-8')).toBe('姓名：小赵');
    // 无备份
    expect(fs.readdirSync(TMP_DIR).filter((f) => f.startsWith('profile.2'))).toEqual([]);
  });

  it('更新时旧文件被备份', () => {
    updateProfile('姓名：小赵\n昵称：赵赵', PROFILE_FILE);
    const backups = fs.readdirSync(TMP_DIR).filter((f) => /^profile\..+\.md$/.test(f));
    expect(backups.length).toBe(1);
    // 备份里是旧内容，当前文件是新内容
    expect(fs.readFileSync(path.join(TMP_DIR, backups[0]), 'utf-8')).toBe('姓名：小赵');
    expect(fs.readFileSync(PROFILE_FILE, 'utf-8')).toContain('赵赵');
  });

  it('多次更新产生多份备份', () => {
    updateProfile('第三版', PROFILE_FILE);
    const backups = fs.readdirSync(TMP_DIR).filter((f) => /^profile\..+\.md$/.test(f));
    expect(backups.length).toBe(2);
    expect(fs.readFileSync(PROFILE_FILE, 'utf-8')).toBe('第三版');
  });
});

describe('profile_update 工具注册', () => {
  it('元信息正确', () => {
    expect(profileUpdateTool.name).toBe('profile_update');
    expect(profileUpdateTool.description).toContain('profile');
  });

  it('已加入 tools 数组', () => {
    expect(tools).toContain(profileUpdateTool);
  });
});
