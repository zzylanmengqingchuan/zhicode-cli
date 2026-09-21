import * as os from 'node:os';
import * as path from 'node:path';
import { isDangerousPath, normalizePath } from './is-dangerous-path';

const HOME = os.homedir();

describe('normalizePath', () => {
  it('展开 ~ 为用户主目录', () => {
    expect(normalizePath('~/.ssh')).toBe(path.join(HOME, '.ssh'));
  });

  it('展开 Windows 环境变量 %USERPROFILE%', () => {
    expect(normalizePath('%USERPROFILE%\\.ssh')).toBe(path.join(HOME, '.ssh'));
  });

  it('展开 %APPDATA% 和 %LOCALAPPDATA%', () => {
    expect(normalizePath('%APPDATA%\\Microsoft')).toBe(
      path.join(HOME, 'AppData', 'Roaming', 'Microsoft'),
    );
    expect(normalizePath('%LOCALAPPDATA%\\Google')).toBe(
      path.join(HOME, 'AppData', 'Local', 'Google'),
    );
  });

  it('相对路径解析为基于 cwd 的绝对路径', () => {
    expect(normalizePath('src/agent')).toBe(path.join(process.cwd(), 'src/agent'));
  });

  it('绝对路径保持不变（规范化）', () => {
    expect(normalizePath('/etc//shadow')).toBe('/etc/shadow');
  });
});

describe('isDangerousPath（macOS 清单）', () => {
  const mac = 'darwin' as const;

  it('~/.ssh 及其子路径是危险路径', () => {
    expect(isDangerousPath('~/.ssh', mac)).toBe(true);
    expect(isDangerousPath('~/.ssh/id_rsa', mac)).toBe(true);
  });

  it('钥匙串和浏览器数据是危险路径', () => {
    expect(isDangerousPath('~/Library/Keychains', mac)).toBe(true);
    expect(
      isDangerousPath('~/Library/Application Support/Google/Chrome/Default/Cookies', mac),
    ).toBe(true);
  });

  it('系统敏感文件是危险路径', () => {
    expect(isDangerousPath('/etc/master.passwd', mac)).toBe(true);
    expect(isDangerousPath('/System/Library', mac)).toBe(true);
  });

  it('普通路径不是危险路径', () => {
    expect(isDangerousPath('~/Documents/notes.md', mac)).toBe(false);
    expect(isDangerousPath('/tmp/test.txt', mac)).toBe(false);
    expect(isDangerousPath('package.json', mac)).toBe(false);
  });

  it('前缀相似但不是同一目录的不算危险（~/.ssh2）', () => {
    expect(isDangerousPath('~/.ssh2/config', mac)).toBe(false);
  });
});

describe('isDangerousPath（linux 清单）', () => {
  it('/etc/shadow、/root 是危险路径', () => {
    expect(isDangerousPath('/etc/shadow', 'linux')).toBe(true);
    expect(isDangerousPath('/root/.bashrc', 'linux')).toBe(true);
    expect(isDangerousPath('/home/user/code', 'linux')).toBe(false);
  });
});

describe('isDangerousPath（windows 清单）', () => {
  it('凭据目录和系统目录是危险路径', () => {
    expect(isDangerousPath('%APPDATA%\\Microsoft\\Credentials', 'win32')).toBe(true);
    expect(isDangerousPath('%USERPROFILE%\\.ssh\\id_rsa', 'win32')).toBe(true);
  });
});
