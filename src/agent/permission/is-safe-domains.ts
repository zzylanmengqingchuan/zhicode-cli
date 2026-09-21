/**
 * 安全域名白名单：中国程序员 / 软件公司 / 互联网公司员工最常用的 100 个主域名
 * 只收录主域名，二级/三级域名由 isSafeDomain 自动归属到主域名
 * 供 network 级别工具的权限判定使用
 */

export const SAFE_DOMAINS: string[] = [
  // —— 代码托管（6）——
  'github.com',
  'gitee.com',
  'gitlab.com',
  'bitbucket.org',
  'coding.net',
  'gitcode.com',

  // —— 技术问答与社区（7）——
  'stackoverflow.com',
  'segmentfault.com',
  'csdn.net',
  'juejin.cn',
  'oschina.net',
  'cnblogs.com',
  'zhihu.com',

  // —— 官方文档与语言（15）——
  'mozilla.org',
  'w3.org',
  'w3school.com.cn',
  'runoob.com',
  'nodejs.org',
  'typescriptlang.org',
  'vuejs.org',
  'react.dev',
  'vitejs.dev',
  'webpack.js.org',
  'eslint.org',
  'python.org',
  'golang.org',
  'rust-lang.org',
  'java.com',

  // —— 包管理与 CDN（7）——
  'npmjs.com',
  'pypi.org',
  'maven.org',
  'rubygems.org',
  'crates.io',
  'jsdelivr.net',
  'unpkg.com',

  // —— 云计算（10）——
  'aliyun.com',
  'tencent.com',
  'qcloud.com',
  'huaweicloud.com',
  'volcengine.com',
  'amazon.com',
  'microsoft.com',
  'google.com',
  'dnspod.cn',
  'cloudflare.com',

  // —— 基础设施与中间件（12）——
  'docker.com',
  'kubernetes.io',
  'nginx.org',
  'apache.org',
  'mysql.com',
  'postgresql.org',
  'redis.io',
  'mongodb.com',
  'elastic.co',
  'grafana.com',
  'jenkins.io',
  'git-scm.com',

  // —— AI 与大模型（7）——
  'openai.com',
  'anthropic.com',
  'moonshot.cn',
  'deepseek.com',
  'bigmodel.cn',
  'modelscope.cn',
  'huggingface.co',

  // —— 办公协作（12）——
  'feishu.cn',
  'dingtalk.com',
  'qq.com',
  'yuque.com',
  'shimo.im',
  'notion.so',
  'figma.com',
  'lanhuapp.com',
  'processon.com',
  'diagrams.net',
  'atlassian.com',
  'tapd.cn',

  // —— 学习与求职（13）——
  'leetcode.com',
  'leetcode.cn',
  'nowcoder.com',
  'lintcode.com',
  'hackerrank.com',
  'infoq.cn',
  'oreilly.com',
  'udemy.com',
  'coursera.org',
  'imooc.com',
  'lagou.com',
  'zhipin.com',
  'linkedin.com',

  // —— 搜索与综合门户（11）——
  'baidu.com',
  'bing.com',
  'sogou.com',
  'duckduckgo.com',
  'wikipedia.org',
  '163.com',
  'sina.com.cn',
  'sohu.com',
  'bilibili.com',
  'weibo.com',
  'douyin.com',
];

/**
 * 判断 URL 是否在安全域名白名单中（二级/三级域名归属到主域名判定）
 */
export function isSafeDomain(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return SAFE_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`));
}
