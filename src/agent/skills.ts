import * as fs from 'node:fs';
import * as path from 'node:path';

export interface SkillMeta {
  name: string;
  description: string;
}

// src/agent/skills（tsx 运行）与 dist/src/agent/skills（编译后，构建时复制）两种位置都能命中
const SKILLS_DIR = path.join(__dirname, 'skills');

function parseFrontmatter(content: string): SkillMeta | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fm = match[1];
  const name = fm.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const descMatch = fm.match(/^description:\s*(.*)$/m);
  if (!name || !descMatch) return null;

  let description = descMatch[1].trim();
  if (description === '>' || description === '|') {
    // YAML 块标量：description 内容在后续的缩进行中，拼成一行
    const rest = fm.slice((descMatch.index ?? 0) + descMatch[0].length);
    const blockLines: string[] = [];
    for (const line of rest.split('\n').slice(1)) {
      if (/^\s+\S/.test(line)) blockLines.push(line.trim());
      else if (line.trim() !== '') break;
    }
    description = blockLines.join(' ');
  }
  if (!description) return null;
  return { name, description };
}

/**
 * 遍历 skills 目录，收集每个 skill 的 name 和 description（启动时调用一次）
 */
export function listSkills(dir: string = SKILLS_DIR): SkillMeta[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const file = path.join(dir, d.name, 'SKILL.md');
      if (!fs.existsSync(file)) return null;
      return parseFrontmatter(fs.readFileSync(file, 'utf-8'));
    })
    .filter((m): m is SkillMeta => m !== null);
}

/**
 * 加载某个 skill 的完整 SKILL.md 内容；不存在时报错并列出可用的 skill
 */
export function loadSkill(name: string, dir: string = SKILLS_DIR): string {
  const file = path.join(dir, name, 'SKILL.md');
  if (!fs.existsSync(file)) {
    const available = listSkills(dir)
      .map((s) => s.name)
      .join(', ');
    throw new Error(`skill 不存在: ${name}。可用的 skill: ${available || '(无)'}`);
  }
  return fs.readFileSync(file, 'utf-8');
}

/**
 * 把技能清单渲染成注入 system prompt 的文本
 * @param metas 技能清单
 * @param dir 展示给 AI 的 skills 目录（项目相对路径，AI 的写文件工具以项目根目录为基准）
 */
export function skillsPrompt(metas: SkillMeta[], dir = 'src/agent/skills'): string {
  if (metas.length === 0) return '';
  const lines = metas.map((s) => `- ${s.name}: ${s.description}`).join('\n');
  return `\n\n你可以使用以下 skills（技能）。当用户的问题命中某个 skill 的描述时，先调用 load_skill 工具加载它的完整内容，再严格按照内容执行：\n${lines}\n\nskills 目录: ${dir}\n如果需要创建新的 skill，也必须放在这个目录下（每个 skill 一个子目录，内含 SKILL.md），不要创建到其他位置。`;
}
