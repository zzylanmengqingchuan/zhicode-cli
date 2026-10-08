import * as os from 'node:os';
import { isInProjectDir, extractFilepath } from './util';

describe('isInProjectDir', () => {
  it('项目目录内的路径返回 true', () => {
    expect(isInProjectDir('src/agent/cli.ts')).toBe(true);
    expect(isInProjectDir(process.cwd())).toBe(true);
  });

  it('~/.zhiwen 目录内的路径返回 true（工作空间免确认）', () => {
    expect(isInProjectDir('~/.zhiwen/skills/demo/SKILL.md')).toBe(true);
    expect(isInProjectDir('~/.zhiwen/.data/checkpointer.db')).toBe(true);
    expect(isInProjectDir(`${os.homedir()}/.zhiwen`)).toBe(true);
  });

  it('项目外的普通路径返回 false', () => {
    expect(isInProjectDir('/tmp/xxx')).toBe(false);
    expect(isInProjectDir('~/Documents/a.txt')).toBe(false);
  });
});

describe('extractFilepath', () => {
  it('兼容 filePath 和 filepath 两种参数名', () => {
    expect(extractFilepath({ filePath: 'a.txt' })).toBe('a.txt');
    expect(extractFilepath({ filepath: 'b.txt' })).toBe('b.txt');
    expect(extractFilepath({})).toBeUndefined();
  });
});
