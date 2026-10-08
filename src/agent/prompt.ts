import * as fs from 'node:fs';
import * as path from 'node:path';
import { DATA_DIR } from './config.js';
import { listRecentMemories } from './db.js';
import { listSkills, skillsPrompt } from './skills.js';

/** 用户画像文件：~/.zhiwen/.data/profile.md */
const PROFILE_PATH = path.join(DATA_DIR, 'profile.md');

/**
 * 读取当前用户的 profile 信息（~/.zhiwen/.data/profile.md）
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
 * 近期长期记忆 prompt：把最近的 memory 直接拼进 system prompt，
 * 每次请求都携带，AI 第一时间知道用户记忆，省去一次 memory_retrieve 工具调用
 */
export function recentMemoriesPrompt(limit = 10): string {
  const memories = listRecentMemories(limit);
  if (memories.length === 0) return '';
  const lines = memories.map((m) => `- [${m.type}] ${m.content}`);
  return `\n\n## Recent Memories\n\n${lines.join('\n')}`;
}

/**
 * 任务规划规则：长任务先建 todo-list，逐步执行并更新状态
 */
const TASK_PLANNING_PROMPT = `## Task Planning

当用户的请求是复杂的多步任务（如数据分析、写文档、开发功能，或明显需要 3 步以上的任务）时，你必须：
1. 先调用 create_todo_list 创建结构化的步骤计划
2. 然后按计划逐步执行
3. 每完成一步调用 update_todo_status 更新该步骤状态（completed，失败则 failed）
4. 全部步骤完成后才输出最终答案

对于简单的单步任务，不要使用 todo 工具。`;

/**
 * 组装完整的 system prompt
 * 顺序：基础人设 → 用户画像（模板+实际信息）→ 近期记忆 → skills → 任务规划规则
 */
export function buildSystemPrompt(): string {
  const skills = listSkills();
  return `You are a helpful assistant.

${profilePrompt()}${recentMemoriesPrompt()}${skillsPrompt(skills)}

${TASK_PLANNING_PROMPT}`;
}
