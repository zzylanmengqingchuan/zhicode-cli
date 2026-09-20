import boxen from 'boxen';
import chalk from 'chalk';
import figlet from 'figlet';
import { loadPkg } from './command.js';

/**
 * 启动横幅：大字体名称 + 信息框 + 使用说明
 */
export function showBanner(): void {
  const pkg = loadPkg();

  // 大字体名称
  console.log(chalk.cyan.bold(figlet.textSync(pkg.name, { font: 'Standard' })));

  // 信息框
  const info = [
    `${chalk.gray('Version:')}     ${pkg.version}`,
    `${chalk.gray('Description:')} ${pkg.description}`,
    `${chalk.gray('Author:')}      ${pkg.author}`,
    `${chalk.gray('Docs:')}        ${pkg.docs}`,
  ].join('\n');

  console.log(
    boxen(info, {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'green',
    }),
  );

  // 使用说明
  console.log(chalk.gray('使用说明:'));
  console.log(`  ${chalk.yellow('ESC')}   取消 AI 请求`);
  console.log(`  ${chalk.yellow('exit')}  退出\n`);
}
