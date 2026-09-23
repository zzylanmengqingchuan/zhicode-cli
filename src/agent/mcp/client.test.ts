import * as fs from 'node:fs';
import * as path from 'node:path';
import { expandEnvVars, loadMcpConfig } from './client';

// 隔离用户配置文件（~/.zhiwen/zhiwen.json）的影响，测试只验证 mcp.json 解析与合并逻辑
jest.mock('../config', () => ({
  ...jest.requireActual('../config'),
  getMcpServerConfig: jest.fn(() => ({})),
}));

const TMP_DIR = path.join(process.cwd(), 'tmp-mcp-test');

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

describe('loadMcpConfig', () => {
  it('能解析 mcp.json 配置', () => {
    fs.mkdirSync(TMP_DIR, { recursive: true });
    const configPath = path.join(TMP_DIR, 'mcp.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        mcpServers: {
          filesystem: { command: 'npx', args: ['-y', 'server-filesystem', '.'], permission_level: 'write' },
        },
      }),
    );
    const config = loadMcpConfig(configPath);
    expect(config.mcpServers?.filesystem.command).toBe('npx');
    expect(config.mcpServers?.filesystem.permission_level).toBe('write');
  });

  it('配置文件不存在时返回空配置', () => {
    expect(loadMcpConfig('/no/such/mcp.json')).toEqual({ mcpServers: {} });
  });

  it('配置文件格式错误时返回空配置', () => {
    const badPath = path.join(TMP_DIR, 'bad.json');
    fs.writeFileSync(badPath, 'not json{');
    expect(loadMcpConfig(badPath)).toEqual({ mcpServers: {} });
  });
});

describe('expandEnvVars', () => {
  it('展开 ${VAR} 环境变量', () => {
    process.env.TEST_MCP_TOKEN = 'secret-123';
    expect(expandEnvVars('Bearer ${TEST_MCP_TOKEN}')).toBe('Bearer secret-123');
    delete process.env.TEST_MCP_TOKEN;
  });

  it('未设置的环境变量展开为空字符串', () => {
    expect(expandEnvVars('Bearer ${NO_SUCH_VAR_XYZ}')).toBe('Bearer ');
  });

  it('不含变量的字符串原样返回', () => {
    expect(expandEnvVars('plain-text')).toBe('plain-text');
  });
});

describe('mcpServers 合并', () => {
  it('用户配置的 mcpServers 合并进 mcp.json', () => {
    const { getMcpServerConfig } = jest.requireMock('../config') as {
      getMcpServerConfig: jest.Mock;
    };
    getMcpServerConfig.mockReturnValueOnce({
      github: { url: 'https://api.githubcopilot.com/mcp/' },
    });
    const config = loadMcpConfig(path.join(TMP_DIR, 'mcp.json'));
    expect(config.mcpServers?.github?.url).toBe('https://api.githubcopilot.com/mcp/');
  });
});
