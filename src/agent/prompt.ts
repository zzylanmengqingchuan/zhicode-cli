import * as fs from 'node:fs';
import * as path from 'node:path';
import { listSkills, skillsPrompt } from './skills.js';

const PROFILE_PATH = path.resolve(process.cwd(), '.data', 'profile.md');

/**
 * 读取当前用户的 profile 信息（.data/profile.md）
 * 文件不存在或没有内容时返回空的 <profile_info></profile_info>
 */
export function loadProfileInfo(profilePath: string = PROFILE_PATH): string {
  let content = '';
  try {
    content = fs.readFileSync(profilePath, 'utf-8').trim();
  } catch {
    content = '';
  }
  if (!content) return '<profile_info></profile_info>';
  return `<profile_info>\n${content}\n</profile_info>`;
}

/**
 * 用户画像 prompt：模板 + 当前用户的实际信息
 */
export function profilePrompt(profilePath?: string): string {
  return `<profile_template>
- 基本身份：姓名，昵称，性别，年龄、地区、语言
- 外貌：身高 体重 肤色 胖瘦
- 性格与沟通偏好
- 兴趣爱好
- 技能
- 工作
</profile_template>

${loadProfileInfo(profilePath)}`;
}

/**
 * 组装完整的 system prompt
 * 顺序：基础人设 → 用户画像（模板+实际信息）→ （memoryPrompt 预留位置）→ skills
 */
export function buildSystemPrompt(): string {
  const skills = listSkills();
  return `You are a helpful assistant.

${profilePrompt()}${skillsPrompt(skills)}`;
}
