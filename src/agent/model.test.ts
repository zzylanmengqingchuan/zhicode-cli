import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadModelConfig } from './model';

const TMP_DIR = path.join(process.cwd(), 'tmp-model-test');

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

function writeConfig(content: unknown): string {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const p = path.join(TMP_DIR, 'zhiwen.json');
  fs.writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content));
  return p;
}

describe('loadModelConfig', () => {
  it('配置文件不存在时报错并给出配置指引', () => {
    expect(() => loadModelConfig(path.join(TMP_DIR, 'no-such.json'))).toThrow('未找到模型配置文件');
  });

  it('正常读取 model 配置', () => {
    const p = writeConfig({
      model: { model: 'deepseek-chat', apiKey: 'sk-test', baseURL: 'https://api.deepseek.com/v1' },
    });
    const config = loadModelConfig(p);
    expect(config.model).toBe('deepseek-chat');
    expect(config.baseURL).toBe('https://api.deepseek.com/v1');
  });

  it('缺少必填字段时报错并指出字段名', () => {
    const p = writeConfig({ model: { model: 'kimi-k2.6' } });
    expect(() => loadModelConfig(p)).toThrow('apiKey');
    expect(() => loadModelConfig(p)).toThrow('baseURL');
  });

  it('JSON 格式错误时报错', () => {
    const p = writeConfig('not-json{');
    expect(() => loadModelConfig(p)).toThrow('不是合法的 JSON');
  });

  it('没有 model 字段时报错', () => {
    const p = writeConfig({ other: {} });
    expect(() => loadModelConfig(p)).toThrow('缺少 model 配置');
  });
});
