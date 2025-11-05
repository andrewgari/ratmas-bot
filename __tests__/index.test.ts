import { main } from '../src/index';

describe('Application', () => {
  it('should have a main function', () => {
    expect(typeof main).toBe('function');
  });

  it('should run without errors', () => {
    expect(() => main()).not.toThrow();
  });
});
