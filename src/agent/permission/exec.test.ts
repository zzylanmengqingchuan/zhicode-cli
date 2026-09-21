import {
  commandEscapesCwd,
  evaluateExecPermission,
  findDangerousCommand,
  findForbiddenInterpreter,
  isSafeCommand,
} from './exec';

describe('commandEscapesCwd', () => {
  it('不含 cd 的命令不跳出', () => {
    expect(commandEscapesCwd('ls -la')).toBe(false);
    expect(commandEscapesCwd('cat package.json && echo done')).toBe(false);
  });

  it('cd 到项目子目录不算跳出', () => {
    expect(commandEscapesCwd('cd src && ls')).toBe(false);
  });

  it('cd .. 跳出', () => {
    expect(commandEscapesCwd('cd .. && ls')).toBe(true);
  });

  it('cd 无参数 / cd ~ 回到家目录，跳出', () => {
    expect(commandEscapesCwd('cd && ls')).toBe(true);
    expect(commandEscapesCwd('cd ~ && ls')).toBe(true);
  });

  it('cd 到绝对路径（项目外）跳出', () => {
    expect(commandEscapesCwd('cd /tmp && ls')).toBe(true);
    expect(commandEscapesCwd('cd /etc')).toBe(true);
  });

  it('cd 到项目目录的绝对路径不跳出', () => {
    expect(commandEscapesCwd(`cd ${process.cwd()} && ls`)).toBe(false);
  });

  it('复合命令中间的 cd 也能识别', () => {
    expect(commandEscapesCwd('echo start; cd /tmp; echo end')).toBe(true);
    expect(commandEscapesCwd('ls | cat && cd ..')).toBe(true);
  });

  it('带引号的路径也能识别', () => {
    expect(commandEscapesCwd('cd "/tmp"')).toBe(true);
    expect(commandEscapesCwd("cd 'src'")).toBe(false);
  });
});

describe('evaluateExecPermission', () => {
  it('跳出目录的命令被阻止并给出原因', () => {
    const result = evaluateExecPermission({ command: 'cd /tmp && ls' });
    expect(result.action).toBe('block');
    expect(result.reason).toContain('项目目录之外');
  });

  it('危险命令被阻止（优先于目录检查）', () => {
    const result = evaluateExecPermission({ command: 'cd /tmp && rm x' });
    expect(result.action).toBe('block');
    expect(result.reason).toContain('删除');
  });

  it('项目内的命令需要用户确认', () => {
    expect(evaluateExecPermission({ command: 'npm run build' }).action).toBe('confirm');
  });

  it('没有 command 参数时需要确认', () => {
    expect(evaluateExecPermission({}).action).toBe('confirm');
  });
});

describe('findForbiddenInterpreter', () => {
  it('python/python3 被阻止并提示 run_py', () => {
    expect(findForbiddenInterpreter('python3 -c "print(1)"')).toContain('run_py');
    expect(findForbiddenInterpreter('python script.py')).toContain('run_py');
  });

  it('node/tsx 被阻止并提示 run_js', () => {
    expect(findForbiddenInterpreter('node app.js')).toContain('run_js');
    expect(findForbiddenInterpreter('tsx script.ts')).toContain('run_js');
  });

  it('其他语言（go/ruby/java/rust）被阻止', () => {
    expect(findForbiddenInterpreter('go run main.go')).toContain('shell');
    expect(findForbiddenInterpreter('ruby app.rb')).toContain('shell');
    expect(findForbiddenInterpreter('java Main')).toContain('shell');
  });

  it('复合命令中的语言调用也能识别', () => {
    expect(findForbiddenInterpreter('ls && python3 x.py')).toContain('run_py');
  });

  it('shell/bash/sh 命令放行', () => {
    expect(findForbiddenInterpreter('sh deploy.sh')).toBeNull();
    expect(findForbiddenInterpreter('bash build.sh && ls')).toBeNull();
    expect(findForbiddenInterpreter('ls -la')).toBeNull();
    expect(findForbiddenInterpreter('echo "python3" 只是字符串')).toBeNull();
  });
});

describe('evaluateExecPermission 语言规则', () => {
  it('python 命令被阻止', () => {
    const result = evaluateExecPermission({ command: 'python3 -c "print(1)"' });
    expect(result.action).toBe('block');
    expect(result.reason).toContain('run_py');
  });

  it('普通 shell 命令仍需确认', () => {
    expect(evaluateExecPermission({ command: 'npm run build' }).action).toBe('confirm');
  });
});

describe('findDangerousCommand', () => {
  it('sudo 超级权限', () => {
    expect(findDangerousCommand('sudo ls')).toContain('超级权限');
    expect(findDangerousCommand('runas /user:admin cmd')).toContain('超级权限');
  });

  it('删除文件/目录', () => {
    expect(findDangerousCommand('rm -rf tmp')).toContain('删除');
    expect(findDangerousCommand('del file.txt')).toContain('删除');
    expect(findDangerousCommand('/bin/rm x')).toContain('删除');
  });

  it('修改/移动文件、修改权限', () => {
    expect(findDangerousCommand('mv a b')).toContain('修改');
    expect(findDangerousCommand('chmod 777 x')).toContain('权限');
    expect(findDangerousCommand('chown root x')).toContain('权限');
  });

  it('进程和服务控制', () => {
    expect(findDangerousCommand('kill -9 1234')).toContain('进程');
    expect(findDangerousCommand('shutdown -h now')).toContain('进程');
    expect(findDangerousCommand('systemctl stop nginx')).toContain('进程');
  });

  it('修改用户信息', () => {
    expect(findDangerousCommand('useradd hacker')).toContain('用户');
    expect(findDangerousCommand('passwd root')).toContain('用户');
  });

  it('获取敏感信息', () => {
    expect(findDangerousCommand('cat /etc/shadow')).toContain('敏感信息');
    expect(findDangerousCommand('cat ~/.ssh/id_rsa')).toContain('敏感信息');
  });

  it('网络和远程控制', () => {
    expect(findDangerousCommand('ssh user@host')).toContain('远程控制');
    expect(findDangerousCommand('curl http://x.com')).toContain('web_fetch');
    expect(findDangerousCommand('wget http://x.com/f')).toContain('web_fetch');
  });

  it('复合命令中的危险操作也能识别', () => {
    expect(findDangerousCommand('ls && rm -rf x')).toContain('删除');
  });

  it('安全命令不误伤', () => {
    expect(findDangerousCommand('ls -la')).toBeNull();
    expect(findDangerousCommand('cat package.json')).toBeNull();
    expect(findDangerousCommand('grep -r "rm" src/')).toBeNull();
    expect(findDangerousCommand('mkdir test && echo done')).toBeNull();
  });
});

describe('isSafeCommand', () => {
  it('白名单命令直接放行', () => {
    expect(isSafeCommand('ls -la')).toBe(true);
    expect(isSafeCommand('pwd')).toBe(true);
    expect(isSafeCommand('cat package.json')).toBe(true);
    expect(isSafeCommand('git status')).toBe(true);
    expect(isSafeCommand('git diff')).toBe(true);
    expect(isSafeCommand('git log --oneline -5')).toBe(true);
    expect(isSafeCommand('whoami && date')).toBe(true);
  });

  it('Windows 命令名也放行', () => {
    expect(isSafeCommand('dir')).toBe(true);
    expect(isSafeCommand('type README.md')).toBe(true);
    expect(isSafeCommand('findstr hello a.txt')).toBe(true);
  });

  it('git 的写操作子命令不放行', () => {
    expect(isSafeCommand('git push')).toBe(false);
    expect(isSafeCommand('git commit -m x')).toBe(false);
  });

  it('混合命令中有非白名单段则不放行', () => {
    expect(isSafeCommand('ls && rm -rf x')).toBe(false);
    expect(isSafeCommand('ls && npm install')).toBe(false);
  });

  it('非白名单命令不放行', () => {
    expect(isSafeCommand('npm run build')).toBe(false);
    expect(isSafeCommand('touch a.txt')).toBe(false);
  });
});

describe('evaluateExecPermission 安全命令', () => {
  it('纯安全命令直接执行（allow）', () => {
    expect(evaluateExecPermission({ command: 'ls src' }).action).toBe('allow');
    expect(evaluateExecPermission({ command: 'git status' }).action).toBe('allow');
  });

  it('非安全命令仍需确认', () => {
    expect(evaluateExecPermission({ command: 'npm install' }).action).toBe('confirm');
  });
});
