import { webFetch, htmlToText } from './web_fetch';
import { webFetchTool, tools } from './index';

describe('htmlToText 实现', () => {
  it('去掉 HTML 标签保留文本', () => {
    expect(htmlToText('<p>Hello <b>World</b></p>')).toBe('Hello World');
  });

  it('去掉 script 和 style 内容', () => {
    const html = '<style>.a{color:red}</style><p>正文</p><script>alert(1)</script>';
    expect(htmlToText(html)).toBe('正文');
  });

  it('处理 HTML 实体并压缩空白', () => {
    expect(htmlToText('<p>a&nbsp;&amp;&lt;b&gt;</p>\n\n<p>c</p>')).toBe('a &<b> c');
  });
});

describe('webFetch 实现', () => {
  it('拒绝非 http/https 链接', async () => {
    expect(await webFetch('ftp://example.com/a.txt')).toContain('获取失败');
    expect(await webFetch('not-a-url')).toContain('获取失败');
  });

  it('连接失败时返回错误信息', async () => {
    // 127.0.0.1:1 端口必定连接被拒
    expect(await webFetch('http://127.0.0.1:1/')).toContain('获取失败');
  });

  it('404 时返回 HTTP 状态', async () => {
    const result = await webFetch('https://example.com/no-such-page-xyz-404');
    expect(result).toMatch(/获取失败|HTTP 404/);
  }, 30000);
});

describe('web_fetch 工具注册', () => {
  it('元信息正确', () => {
    expect(webFetchTool.name).toBe('web_fetch');
    expect(webFetchTool.description).toContain('URL');
  });

  it('已加入 tools 数组', () => {
    expect(tools).toContain(webFetchTool);
  });
});
