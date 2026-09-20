import { loadSkill } from '../skills.js';

/**
 * load_skill 工具的具体实现（纯函数，方便单元测试）
 * 加载指定 skill 的完整 SKILL.md 内容，每次只能加载一个
 */
export async function loadSkillContent(name: string): Promise<string> {
  return loadSkill(name);
}
