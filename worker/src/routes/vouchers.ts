import { Hono } from 'hono';
import type { Bindings } from '../index';

// Stub — full implementation in Task 4
export const vouchersRoute = new Hono<{ Bindings: Bindings }>();
