/**
 * todo-list：长任务计划的数据结构与纯函数逻辑
 * todoList 存在 graph state 中，由 SqliteSaver 自动持久化，
 * 不受 context 压缩影响，退出重进也不丢失
 */

export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface TodoItem {
  id: number;
  title: string;
  status: TodoStatus;
}

export const TODO_STATUSES: TodoStatus[] = ['pending', 'in_progress', 'completed', 'failed'];

/** 把 LLM 给出的步骤标题列表转成 TodoItem 列表（id 从 1 开始，全部 pending） */
export function createTodoItems(titles: string[]): TodoItem[] {
  const cleaned = titles.map((t) => t.trim()).filter((t) => t.length > 0);
  if (cleaned.length === 0) {
    throw new Error('todo-list 至少需要包含一个步骤');
  }
  return cleaned.map((title, i) => ({ id: i + 1, title, status: 'pending' }));
}

/** 更新指定 id 的状态，返回新数组（不修改原数组）；id 不存在时抛错 */
export function applyTodoStatus(
  todos: TodoItem[],
  id: number,
  status: TodoStatus,
): TodoItem[] {
  if (!TODO_STATUSES.includes(status)) {
    throw new Error(`无效的状态: ${status}，可选: ${TODO_STATUSES.join(' / ')}`);
  }
  const target = todos.find((t) => t.id === id);
  if (!target) {
    throw new Error(`todo 不存在（id: ${id}），当前共 ${todos.length} 项`);
  }
  return todos.map((t) => (t.id === id ? { ...t, status } : t));
}

const STATUS_MARK: Record<TodoStatus, string> = {
  pending: '[ ]',
  in_progress: '[~]',
  completed: '[x]',
  failed: '[!]',
};

/** 格式化打印 todo-list（展示给用户，也作为工具输出文本） */
export function formatTodoList(todos: TodoItem[]): string {
  const lines = todos.map((t) => {
    const suffix = t.status === 'in_progress' ? '（进行中）' : t.status === 'failed' ? '（失败）' : '';
    return `${t.id}. ${STATUS_MARK[t.status]} ${t.title}${suffix}`;
  });
  return `📋 Todo List:\n${lines.join('\n')}`;
}

/**
 * 拼进 system prompt 的当前进度（空列表时不占 prompt 空间，返回空串）
 */
export function todoListPrompt(todos: TodoItem[] | undefined): string {
  if (!todos || todos.length === 0) return '';
  return `\n\n## 当前 Todo List 进度\n\n${formatTodoList(todos)}`;
}
