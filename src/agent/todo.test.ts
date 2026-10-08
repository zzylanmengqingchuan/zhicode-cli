import {
  applyTodoStatus,
  createTodoItems,
  formatTodoList,
  todoListPrompt,
  type TodoItem,
} from './todo';

describe('createTodoItems', () => {
  it('标题列表转成 pending 状态的 todo 项，id 从 1 开始', () => {
    const items = createTodoItems(['设计数据结构', '实现工具', '编写测试']);
    expect(items).toEqual([
      { id: 1, title: '设计数据结构', status: 'pending' },
      { id: 2, title: '实现工具', status: 'pending' },
      { id: 3, title: '编写测试', status: 'pending' },
    ]);
  });

  it('过滤空白标题', () => {
    const items = createTodoItems(['  第一步  ', '   ', '第二步']);
    expect(items.map((t) => t.title)).toEqual(['第一步', '第二步']);
  });

  it('空列表抛错', () => {
    expect(() => createTodoItems([])).toThrow('至少');
    expect(() => createTodoItems(['   '])).toThrow('至少');
  });
});

describe('applyTodoStatus', () => {
  const todos: TodoItem[] = [
    { id: 1, title: '第一步', status: 'pending' },
    { id: 2, title: '第二步', status: 'pending' },
  ];

  it('更新指定 id 的状态，不修改原数组', () => {
    const next = applyTodoStatus(todos, 2, 'in_progress');
    expect(next[1].status).toBe('in_progress');
    expect(todos[1].status).toBe('pending');
    expect(next[0].status).toBe('pending');
  });

  it('id 不存在时抛错', () => {
    expect(() => applyTodoStatus(todos, 99, 'completed')).toThrow('不存在');
  });

  it('非法状态时抛错', () => {
    expect(() => applyTodoStatus(todos, 1, 'done' as TodoItem['status'])).toThrow('无效的状态');
  });
});

describe('formatTodoList', () => {
  it('按状态显示不同标记', () => {
    const text = formatTodoList([
      { id: 1, title: '已完成', status: 'completed' },
      { id: 2, title: '进行中', status: 'in_progress' },
      { id: 3, title: '待做', status: 'pending' },
      { id: 4, title: '失败了', status: 'failed' },
    ]);
    expect(text).toContain('1. [x] 已完成');
    expect(text).toContain('2. [~] 进行中（进行中）');
    expect(text).toContain('3. [ ] 待做');
    expect(text).toContain('4. [!] 失败了（失败）');
  });
});

describe('todoListPrompt', () => {
  it('空列表或 undefined 返回空串（不占 prompt 空间）', () => {
    expect(todoListPrompt([])).toBe('');
    expect(todoListPrompt(undefined)).toBe('');
  });

  it('有内容时返回进度段落', () => {
    const text = todoListPrompt([{ id: 1, title: '第一步', status: 'completed' }]);
    expect(text).toContain('当前 Todo List 进度');
    expect(text).toContain('1. [x] 第一步');
  });
});
