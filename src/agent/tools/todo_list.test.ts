import { createTodoListText, updateTodoStatusText } from './todo_list';
import type { TodoItem } from '../todo';

let logSpy: jest.SpyInstance;

beforeEach(() => {
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
});

describe('createTodoListText', () => {
  it('返回创建确认并打印列表', () => {
    const text = createTodoListText(['第一步', '第二步']);
    expect(text).toContain('共 2 项');
    expect(text).toContain('1. [ ] 第一步');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Todo List'));
  });

  it('空步骤列表抛错', () => {
    expect(() => createTodoListText([])).toThrow();
  });
});

describe('updateTodoStatusText', () => {
  const todos: TodoItem[] = [
    { id: 1, title: '第一步', status: 'pending' },
    { id: 2, title: '第二步', status: 'pending' },
  ];

  it('没有 todo-list 时提示先创建', () => {
    expect(updateTodoStatusText(undefined, 1, 'completed')).toContain('请先调用 create_todo_list');
    expect(updateTodoStatusText([], 1, 'completed')).toContain('请先调用 create_todo_list');
  });

  it('更新成功时返回新状态文本', () => {
    const text = updateTodoStatusText(todos, 1, 'completed');
    expect(text).toContain('1. [x] 第一步');
    expect(text).toContain('2. [ ] 第二步');
  });

  it('id 不存在时返回失败原因', () => {
    expect(updateTodoStatusText(todos, 99, 'completed')).toContain('更新失败');
  });
});
