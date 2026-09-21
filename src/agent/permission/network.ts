import { isSafeDomain } from './is-safe-domains.js';

export interface NetworkPermissionResult {
  action: 'allow' | 'confirm';
  url?: string;
}

/**
 * network 级别工具的权限判定：
 * - 没有 url 参数 → 直接执行
 * - url 的域名在安全白名单中 → 直接执行
 * - 其他域名 → 询问用户确认
 */
export function evaluateNetworkPermission(args: unknown): NetworkPermissionResult {
  const url = (args as { url?: string } | null | undefined)?.url;
  if (!url) return { action: 'allow' };

  if (isSafeDomain(url)) {
    return { action: 'allow', url };
  }
  return { action: 'confirm', url };
}
