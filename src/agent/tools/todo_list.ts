import {
  applyTodoStatus,
  createTodoItems,
  formatTodoList,
  type TodoItem,
  type TodoStatus,
} from '../todo.js';

/**
 * create_todo_list 工具的具体实现（打印 + 返回文本，纯函数方便测试）
 * state 的更新由 graph 的 toolNode 根据调用参数完成（见 graph.ts）
 */
export function createTodoListText(titles: string[]): string {
  const items = createTodoItems(titles);
  console.log(`\n${formatTodoList(items)}`);
  return `todo-list 已创建（共 ${items.length} 项），开始逐步执行：\n${formatTodoList(items)}`;
}

/**
 * update_todo_status 工具的具体实现
 * @param current 当前 state 中的 todoList（由调用方从 graph state 取出）
 */
export function updateTodoStatusText(
  current: TodoItem[] | undefined,
  id: number,
  status: TodoStatus,
): string {
  if (!current || current.length === 0) {
    return '当前没有 todo-list，请先调用 create_todo_list 创建计划';
  }
  let next: TodoItem[];
  try {
    next = applyTodoStatus(current, id, status);
  } catch (err) {
    return `更新失败: ${err instanceof Error ? err.message : String(err)}`;
  }
  console.log(`\n${formatTodoList(next)}`);
  return `todo 状态已更新：\n${formatTodoList(next)}`;
}
