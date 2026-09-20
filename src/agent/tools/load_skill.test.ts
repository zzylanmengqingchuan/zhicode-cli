import { loadSkillContent } from './load_skill';
import { listSkills, skillsPrompt } from '../skills';
import { loadSkillTool, tools } from '../tools';

describe('loadSkillContent 实现', () => {
  it('能加载 planner skill 的完整内容', async () => {
    const content = await loadSkillContent('planner');
    expect(content).toContain('name: planner');
    expect(content).toContain('# 计划制定指南');
  });

  it('能加载 programmer-resume skill 的完整内容', async () => {
    const content = await loadSkillContent('programmer-resume');
    expect(content).toContain('name: programmer-resume');
    expect(content).toContain('程序员简历');
  });

  it('加载时会打印 skill 名称（打印已统一到 toolNode，此处只验证内容）', async () => {
    const content = await loadSkillContent('planner');
    expect(content).toContain('计划制定指南');
  });

  it('skill 不存在时报错并列出可用 skill', async () => {
    await expect(loadSkillContent('no-such-skill')).rejects.toThrow('skill 不存在');
    await expect(loadSkillContent('no-such-skill')).rejects.toThrow('planner');
  });
});

describe('listSkills 扫描', () => {
  it('能收集到所有 skill 的 name 和 description', () => {
    const skills = listSkills();
    const names = skills.map((s) => s.name);
    expect(names).toContain('planner');
    expect(names).toContain('programmer-resume');
    for (const s of skills) {
      expect(s.description.length).toBeGreaterThan(0);
    }
  });

  it('能解析多行 YAML 块标量 description（> 语法）', () => {
    const skills = listSkills();
    const poem = skills.find((s) => s.name === 'poem-writer');
    // poem-writer 的 description 是多行块标量，不应只解析出 ">"
    expect(poem).toBeDefined();
    expect(poem!.description).not.toBe('>');
    expect(poem!.description).toContain('七言绝句');
  });
});

describe('skillsPrompt 提示文本', () => {
  it('包含 skills 目录位置和新建 skill 的存放规则', () => {
    const text = skillsPrompt([{ name: 'demo', description: '演示' }]);
    expect(text).toContain('- demo: 演示');
    expect(text).toContain('skills 目录: src/agent/skills');
    expect(text).toContain('必须放在这个目录下');
  });

  it('没有 skill 时返回空字符串', () => {
    expect(skillsPrompt([])).toBe('');
  });
});

describe('load_skill 工具注册', () => {
  it('元信息正确', () => {
    expect(loadSkillTool.name).toBe('load_skill');
    expect(loadSkillTool.description).toContain('加载');
  });

  it('已加入 tools 数组', () => {
    expect(tools).toContain(loadSkillTool);
  });
});
