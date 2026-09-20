import { add, greet } from './index';

describe('add', () => {
  it('should add two numbers', () => {
    expect(add(1, 2)).toBe(3);
  });

  it('should handle negative numbers', () => {
    expect(add(-1, 1)).toBe(0);
  });
});

describe('greet', () => {
  it('should return a greeting', () => {
    expect(greet('World')).toBe('Hello, World!');
  });
});
