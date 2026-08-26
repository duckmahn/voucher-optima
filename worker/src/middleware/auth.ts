import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { Bindings } from '../index';
import { verifyNextAuthSessionToken } from '../lib/verify-session-token';

type Variables = { userId: string };

export const authMiddleware = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(
  async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new HTTPException(401, { message: 'Missing or invalid Authorization header' });
    }
    const token = authHeader.slice(7);
    const cookieNameHint = c.req.header('X-Session-Cookie-Name') ?? undefined;
    try {
      const { sub } = await verifyNextAuthSessionToken(token, c.env.NEXTAUTH_SECRET, cookieNameHint);
      c.set('userId', sub);
      await next();
    } catch {
      throw new HTTPException(401, { message: 'Invalid or expired token' });
    }
  }
);
