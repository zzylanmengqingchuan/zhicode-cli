import { runSubAgent } from './sub_agent';
import { agentTool, tools } from '../tools';

describe('agent 工具注册', () => {
  it('元信息正确', () => {
    expect(agentTool.name).toBe('agent');
    expect(agentTool.description).toContain('子 agent');
    expect(agentTool.permission_level).toBe('exec');
  });

  it('已加入 tools 数组', () => {
    expect(tools).toContain(agentTool);
  });
});

describe('runSubAgent 实现', () => {
  it('子 agent 能独立完成简单任务并返回结果', async () => {
    const result = await runSubAgent('直接回复两个字：完成');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  }, 60000);

  it('子 agent 可以使用工具（run_js），但工具列表中没有 agent（不能嵌套）', async () => {
    const result = await runSubAgent(
      '使用 run_js 工具执行 console.log(40 + 2)，然后直接把计算结果数字回复给我',
    );
    expect(result).toContain('42');
  }, 120000);
});
