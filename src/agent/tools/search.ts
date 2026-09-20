/**
 * search 工具的具体实现（纯函数，方便单元测试）
 * 工具的 name/description/schema 声明统一在 tools.ts 中管理
 */
export async function searchWeb(query: string): Promise<string> {
  if (
    query.toLowerCase().includes('sf') ||
    query.toLowerCase().includes('san francisco')
  ) {
    return "It's 60 degrees and foggy.";
  }
  return "It's 90 degrees and sunny.";
}
