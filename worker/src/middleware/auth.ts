import { createMiddleware } from 'hono/factory';
import type { Bindings } from '../index';

// Stub — full implementation in Task 3
export const authMiddleware = createMiddleware<{ Bindings: Bindings }>(async (_c, next) => {
  await next();
});
