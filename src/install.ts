import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';
import { CONFIG_PATH, DATA_DIR, ZHIWEN_DIR } from './agent/config.js';
import { initDb } from './agent/db.js';

const USER_SKILLS_DIR = path.join(ZHIWEN_DIR, 'skills');

function step(msg: string): void {
  console.log(chalk.cyan(`  → ${msg}`));
}

function ok(msg: string): void {
  console.log(chalk.green(`  ✓ ${msg}`));
}

function installSkillCreator(): void {
  // 项目内置的 skill-creator 直接复制（离线可用）
  const from = path.join(__dirname, 'agent', 'skills', 'skill-creator');
  const dest = path.join(USER_SKILLS_DIR, 'skill-creator');
  if (fs.existsSync(dest)) return;
  fs.cpSync(from, dest, { recursive: true });
  ok(`skill-creator 已安装到 ${dest}`);
}

function installFindSkills(): void {
  const dest = path.join(USER_SKILLS_DIR, 'find-skills');
  if (fs.existsSync(dest)) return;
  step('正在从 GitHub 下载 find-skills（首次较慢）...');
  execFileSync(
    'npx',
    [
      '-y',
      'skills',
      'add',
      'https://github.com/vercel-labs/skills/tree/main/skills/find-skills',
      '-a',
      'openclaw',
      '-y',
      '--copy',
    ],
    { stdio: 'inherit', timeout: 300000 },
  );
  // npx skills add 安装到当前目录的 skills/ 下，移动到用户目录
  const from = path.join(process.cwd(), 'skills', 'find-skills');
  if (fs.existsSync(from)) {
    fs.cpSync(from, dest, { recursive: true });
    fs.rmSync(path.join(process.cwd(), 'skills'), { recursive: true, force: true });
  }
  ok(`find-skills 已安装到 ${dest}`);
}

function createConfigTemplate(): void {
  const template = {
    model: {
      model: 'kimi-k2.6',
      apiKey: '在此填入你的模型 API Key',
      baseURL: 'https://api.moonshot.cn/v1',
    },
    env: {},
  };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(template, null, 2));
  ok(`配置文件已创建: ${CONFIG_PATH}`);
}

/**
 * 首次运行检测：配置文件不存在则执行初始化安装，完成后退出并提示用户先填写配置
 */
export async function runInstallIfFirstRun(): Promise<void> {
  if (fs.existsSync(CONFIG_PATH)) return;

  console.log(chalk.bold('\n检测到首次运行 zhiwen，开始初始化...\n'));

  step('初始化用户目录与数据库');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  initDb();
  ok('数据库已就绪（~/.zhiwen/.data/checkpointer.db）');

  step('安装 skills');
  fs.mkdirSync(USER_SKILLS_DIR, { recursive: true });
  installSkillCreator();
  installFindSkills();

  step('创建配置文件');
  fs.mkdirSync(ZHIWEN_DIR, { recursive: true });
  createConfigTemplate();

  console.log(chalk.bold('\n初始化完成！'));
  console.log(chalk.yellow(`下一步：请编辑 ${CONFIG_PATH}，填入你的模型 API Key，然后重新运行 zhiwen。`));
  console.log(chalk.yellow('参考文档: https://github.com/zzylanmengqingchuan/zhicode-cli\n'));
  process.exit(0);
}
