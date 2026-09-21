import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadProfileInfo, profilePrompt } from './prompt';

const TMP_DIR = path.join(process.cwd(), 'tmp-prompt-test');
const PROFILE_FILE = path.join(TMP_DIR, 'profile.md');

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

describe('loadProfileInfo', () => {
  it('文件不存在时返回空的 profile_info', () => {
    expect(loadProfileInfo(path.join(TMP_DIR, 'no-such.md'))).toBe('<profile_info></profile_info>');
  });

  it('文件没有内容时返回空的 profile_info', () => {
    fs.mkdirSync(TMP_DIR, { recursive: true });
    fs.writeFileSync(PROFILE_FILE, '   \n  ');
    expect(loadProfileInfo(PROFILE_FILE)).toBe('<profile_info></profile_info>');
  });

  it('文件有内容时内容被 <profile_info> 包裹', () => {
    fs.mkdirSync(TMP_DIR, { recursive: true });
    fs.writeFileSync(PROFILE_FILE, '姓名：小赵\n职业：前端工程师');
    const result = loadProfileInfo(PROFILE_FILE);
    expect(result).toContain('<profile_info>');
    expect(result).toContain('姓名：小赵');
    expect(result).toContain('</profile_info>');
  });
});

describe('profilePrompt', () => {
  it('包含模板和 profile_info', () => {
    const prompt = profilePrompt(path.join(TMP_DIR, 'no-such.md'));
    expect(prompt).toContain('<profile_template>');
    expect(prompt).toContain('基本身份');
    expect(prompt).toContain('<profile_info></profile_info>');
  });
});
