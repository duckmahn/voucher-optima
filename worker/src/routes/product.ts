import { Hono } from 'hono';
import type { Bindings } from '../index';

// Stub — full implementation in Task 9
export const productRoute = new Hono<{ Bindings: Bindings }>();
