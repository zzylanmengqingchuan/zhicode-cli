const MAX_OUTPUT = 4000;

/**
 * 把 HTML 清洗成纯文本：去掉 script/style/标签，压缩空白
 * （独立成纯函数，方便单元测试）
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * web_fetch 工具的具体实现（纯函数，方便单元测试）
 * 根据 URL 获取网络资源内容；失败时把错误信息返回给 AI
 */
export async function webFetch(url: string, timeoutMs = 15000): Promise<string> {
  if (!/^https?:\/\//.test(url)) {
    return `获取失败: 只支持 http/https 链接，收到的是: ${url}`;
  }

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    return `获取失败: ${err instanceof Error ? err.message : String(err)}`;
  }

  if (!res.ok) {
    return `获取失败: HTTP ${res.status} ${res.statusText}`;
  }

  const contentType = res.headers.get('content-type') ?? '';
  const body = await res.text();
  const text = contentType.includes('text/html') ? htmlToText(body) : body.trim();

  if (!text) {
    return '获取成功，但页面内容为空';
  }
  return text.length > MAX_OUTPUT ? `${text.slice(0, MAX_OUTPUT)}\n...(内容已截断)` : text;
}
