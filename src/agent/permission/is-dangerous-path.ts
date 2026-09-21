import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

interface DangerousPaths {
  macos: string[];
  windows: string[];
  linux: string[];
}

function loadDangerousPaths(): DangerousPaths {
  // __dirname 在 tsx 下是 src/agent/permission，编译后是 dist/src/agent/permission（构建时复制 json）
  try {
    return JSON.parse(
      fs.readFileSync(path.join(__dirname, 'dangerous-path.json'), 'utf-8'),
    ) as DangerousPaths;
  } catch {
    return { macos: [], windows: [], linux: [] };
  }
}

const DANGEROUS_PATHS = loadDangerousPaths();

/**
 * 规范化路径：展开 Windows 环境变量、~ 和相对路径，输出可比较的绝对路径
 */
export function normalizePath(filepath: string): string {
  let p = filepath.trim();

  // Windows 环境变量（大小写不敏感）
  const home = os.homedir();
  const envMap: Record<string, string> = {
    '%USERPROFILE%': home,
    '%APPDATA%': path.join(home, 'AppData', 'Roaming'),
    '%LOCALAPPDATA%': path.join(home, 'AppData', 'Local'),
  };
  for (const [key, value] of Object.entries(envMap)) {
    if (p.toUpperCase().startsWith(key)) {
      p = value + p.slice(key.length);
      break;
    }
  }

  // Windows 反斜杠统一为正斜杠（本函数只用于权限比较，不涉及真实文件操作）
  p = p.replace(/\\/g, '/');

  // ~ 展开为用户主目录
  if (p === '~' || p.startsWith('~/')) {
    p = path.join(home, p.slice(1));
  }

  // 相对路径 → 绝对路径（基于当前工作目录）
  return path.normalize(path.resolve(p));
}

function osKey(platform: NodeJS.Platform): keyof DangerousPaths {
  if (platform === 'darwin') return 'macos';
  if (platform === 'win32') return 'windows';
  return 'linux';
}

/**
 * 判断一个文件路径是否是危险路径（命中当前操作系统危险清单中的目录或其子路径）
 */
export function isDangerousPath(
  filepath: string,
  platform: NodeJS.Platform = process.platform,
): boolean {
  const target = normalizePath(filepath);
  return DANGEROUS_PATHS[osKey(platform)].some((pattern) => {
    const norm = normalizePath(pattern);
    return target === norm || target.startsWith(norm + path.sep);
  });
}
