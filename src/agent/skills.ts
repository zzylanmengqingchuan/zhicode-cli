import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ZHIWEN_DIR } from './config.js';

export interface SkillMeta {
  name: string;
  description: string;
}

// 内置 skills（src/agent/skills，构建时复制到 dist 同位置）
const BUILTIN_SKILLS_DIR = path.join(__dirname, 'skills');

/**
 * skills 多级目录（按优先级从低到高，后者覆盖前者的同名 skill）：
 * 1. 内置（项目自带）
 * 2. ~/.agents/skills           全局第三方
 * 3. ~/.zhiwen/.agents/skills   zhiwen 第三方安装（npx skills add）
 * 4. ~/.zhiwen/skills           zhiwen 用户自建（最高优先级）
 */
export function skillDirs(): string[] {
  const home = os.homedir();
  return [
    BUILTIN_SKILLS_DIR,
    path.join(home, '.agents', 'skills'),
    path.join(ZHIWEN_DIR, '.agents', 'skills'),
    path.join(ZHIWEN_DIR, 'skills'),
  ];
}

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

function scanDir(dir: string): { meta: SkillMeta; fileDir: string }[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const fileDir = path.join(dir, d.name);
      const file = path.join(fileDir, 'SKILL.md');
      if (!fs.existsSync(file)) return null;
      const meta = parseFrontmatter(fs.readFileSync(file, 'utf-8'));
      return meta ? { meta, fileDir } : null;
    })
    .filter((r): r is { meta: SkillMeta; fileDir: string } => r !== null);
}

// skill 名称 → SKILL.md 所在目录（listSkills 时构建，供 loadSkill 定位）
let skillDirMap = new Map<string, string>();

/**
 * 按多级目录收集所有 skill 的 name 和 description（启动时调用一次）。
 * 目录不存在直接跳过；同名 skill 后者覆盖前者。
 */
export function listSkills(dirs: string[] = skillDirs()): SkillMeta[] {
  const map = new Map<string, SkillMeta>();
  skillDirMap = new Map();
  for (const dir of dirs) {
    for (const { meta, fileDir } of scanDir(dir)) {
      map.set(meta.name, meta);
      skillDirMap.set(meta.name, fileDir);
    }
  }
  return [...map.values()];
}

/**
 * 加载某个 skill 的完整 SKILL.md 内容；不存在时报错并列出可用的 skill
 */
export function loadSkill(name: string): string {
  // 未调用过 listSkills 时先扫描一次，保证目录映射存在
  if (skillDirMap.size === 0) listSkills();

  const fileDir = skillDirMap.get(name);
  const file = fileDir ? path.join(fileDir, 'SKILL.md') : null;
  if (!file || !fs.existsSync(file)) {
    const available = listSkills()
      .map((s) => s.name)
      .join(', ');
    throw new Error(`skill 不存在: ${name}。可用的 skill: ${available || '(无)'}`);
  }
  return fs.readFileSync(file, 'utf-8');
}

/** 展示给 AI 的用户自建 skills 目录（新建 skill 放这里） */
export const USER_SKILLS_DIR = path.join(ZHIWEN_DIR, 'skills');

/**
 * 把技能清单渲染成注入 system prompt 的文本
 * @param metas 技能清单
 * @param dir 展示给 AI 的 skills 目录（新建 skill 的存放位置）
 */
export function skillsPrompt(metas: SkillMeta[], dir: string = USER_SKILLS_DIR): string {
  if (metas.length === 0) return '';
  const lines = metas.map((s) => `- ${s.name}: ${s.description}`).join('\n');
  return `\n\n你可以使用以下 skills（技能）。当用户的问题命中某个 skill 的描述时，先调用 load_skill 工具加载它的完整内容，再严格按照内容执行：\n${lines}\n\nskills 目录: ${dir}\n如果需要创建新的 skill，也必须放在这个目录下（每个 skill 一个子目录，内含 SKILL.md），不要创建到其他位置。`;
}
