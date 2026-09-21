import { evaluateNetworkPermission } from './network';
import { isSafeDomain } from './is-safe-domains';

describe('isSafeDomain', () => {
  it('主域名命中', () => {
    expect(isSafeDomain('https://github.com/user/repo')).toBe(true);
  });

  it('二级/三级域名归属主域名', () => {
    expect(isSafeDomain('https://api.github.com/repos')).toBe(true);
    expect(isSafeDomain('https://developer.mozilla.org/zh-CN/')).toBe(true);
  });

  it('白名单外域名不命中', () => {
    expect(isSafeDomain('https://evil-site.com/')).toBe(false);
  });

  it('钓鱼伪装域名不误命中', () => {
    expect(isSafeDomain('https://github.com.evil.com/')).toBe(false);
  });

  it('非法 URL 返回 false', () => {
    expect(isSafeDomain('not-a-url')).toBe(false);
  });
});

describe('evaluateNetworkPermission', () => {
  it('没有 url 参数直接执行', () => {
    expect(evaluateNetworkPermission({ query: 'test' }).action).toBe('allow');
  });

  it('安全域名直接执行', () => {
    const result = evaluateNetworkPermission({ url: 'https://github.com/x' });
    expect(result.action).toBe('allow');
  });

  it('非安全域名需要用户确认', () => {
    const result = evaluateNetworkPermission({ url: 'https://unknown-site.xyz/page' });
    expect(result.action).toBe('confirm');
    expect(result.url).toBe('https://unknown-site.xyz/page');
  });
});
