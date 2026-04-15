import { Hono } from 'hono';
import type { Bindings } from '../index';

// Stub — full implementation in Task 5
export const comparisonsRoute = new Hono<{ Bindings: Bindings }>();
