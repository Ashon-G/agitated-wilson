/**
 * Jest type declarations
 * This file provides type definitions for Jest testing framework
 */

declare global {
  namespace jest {
    interface Matchers<R> {
      toBe(expected: any): R;
      toEqual(expected: any): R;
      toBeTruthy(): R;
      toBeFalsy(): R;
      toBeNull(): R;
      toBeUndefined(): R;
      toBeDefined(): R;
      toContain(expected: any): R;
      toHaveLength(expected: number): R;
      toThrow(expected?: any): R;
      toMatch(expected: string | RegExp): R;
      toBeCloseTo(expected: number, precision?: number): R;
      toBeGreaterThan(expected: number): R;
      toBeGreaterThanOrEqual(expected: number): R;
      toBeLessThan(expected: number): R;
      toBeLessThanOrEqual(expected: number): R;
    }
  }

  // Jest globals
  function describe(name: string, fn: () => void): void;
  function it(name: string, fn: () => void | Promise<void>): void;
  function test(name: string, fn: () => void | Promise<void>): void;
  function expect(actual: any): jest.Matchers<any>;
  function beforeEach(fn: () => void | Promise<void>): void;
  function afterEach(fn: () => void | Promise<void>): void;
  function beforeAll(fn: () => void | Promise<void>): void;
  function afterAll(fn: () => void | Promise<void>): void;
  function jest(): typeof jest;
}

export {};
