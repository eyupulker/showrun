import { describe, it, expect } from 'vitest';
import { ConcurrencyLimiter } from '../concurrency.js';

describe('ConcurrencyLimiter', () => {
  it('throws for concurrency < 1', () => {
    expect(() => new ConcurrencyLimiter(0)).toThrow('Concurrency must be at least 1');
    expect(() => new ConcurrencyLimiter(-1)).toThrow('Concurrency must be at least 1');
  });

  it('allows concurrency of 1', () => {
    expect(() => new ConcurrencyLimiter(1)).not.toThrow();
  });

  it('executes immediately when under limit', async () => {
    const limiter = new ConcurrencyLimiter(2);
    const result = await limiter.execute(async () => 'result');
    expect(result).toBe('result');
  });

  it('returns the correct result from executed function', async () => {
    const limiter = new ConcurrencyLimiter(1);
    const result = await limiter.execute(async () => ({ foo: 'bar', count: 42 }));
    expect(result).toEqual({ foo: 'bar', count: 42 });
  });

  it('queues tasks when at limit', async () => {
    const limiter = new ConcurrencyLimiter(1);
    const order: number[] = [];

    const task1 = limiter.execute(async () => {
      await new Promise(r => setTimeout(r, 50));
      order.push(1);
    });
    const task2 = limiter.execute(async () => order.push(2));

    expect(limiter.getQueueLength()).toBe(1);
    expect(limiter.getRunningCount()).toBe(1);

    await Promise.all([task1, task2]);
    expect(order).toEqual([1, 2]);
  });

  it('allows multiple concurrent tasks up to limit', async () => {
    const limiter = new ConcurrencyLimiter(2);
    const order: number[] = [];

    const task1 = limiter.execute(async () => {
      await new Promise(r => setTimeout(r, 50));
      order.push(1);
    });
    const task2 = limiter.execute(async () => {
      await new Promise(r => setTimeout(r, 50));
      order.push(2);
    });
    const task3 = limiter.execute(async () => order.push(3));

    // With concurrency 2, first two run immediately, third is queued
    expect(limiter.getRunningCount()).toBe(2);
    expect(limiter.getQueueLength()).toBe(1);

    await Promise.all([task1, task2, task3]);
    // Task 3 should complete after at least one of task 1 or 2
    expect(order).toContain(3);
  });

  it('propagates errors', async () => {
    const limiter = new ConcurrencyLimiter(1);
    await expect(
      limiter.execute(async () => { throw new Error('Test error'); })
    ).rejects.toThrow('Test error');
  });

  it('continues processing queue after error', async () => {
    const limiter = new ConcurrencyLimiter(1);
    let task1Completed = false;
    let task2Completed = false;

    const task1 = limiter.execute(async () => {
      throw new Error('Task 1 failed');
    }).catch(() => {
      task1Completed = true;
    });

    const task2 = limiter.execute(async () => {
      task2Completed = true;
      return 'done';
    });

    await Promise.all([task1, task2]);

    // Both tasks should have completed, demonstrating queue continues after error
    expect(task1Completed).toBe(true);
    expect(task2Completed).toBe(true);
  });

  it('reports correct running count', async () => {
    const limiter = new ConcurrencyLimiter(3);
    expect(limiter.getRunningCount()).toBe(0);

    const tasks = [
      limiter.execute(() => new Promise(r => setTimeout(r, 100))),
      limiter.execute(() => new Promise(r => setTimeout(r, 100))),
    ];

    expect(limiter.getRunningCount()).toBe(2);

    await Promise.all(tasks);
    expect(limiter.getRunningCount()).toBe(0);
  });

  it('reports correct queue length', async () => {
    const limiter = new ConcurrencyLimiter(1);
    expect(limiter.getQueueLength()).toBe(0);

    const task1 = limiter.execute(() => new Promise(r => setTimeout(r, 100)));
    const task2 = limiter.execute(() => Promise.resolve());
    const task3 = limiter.execute(() => Promise.resolve());

    expect(limiter.getQueueLength()).toBe(2);

    await Promise.all([task1, task2, task3]);
    expect(limiter.getQueueLength()).toBe(0);
  });
});
