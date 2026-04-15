import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { Bindings } from '../index';

type Variables = { userId: string };

async function verifyNextAuthJwt(token: string, secret: string): Promise<{ sub: string }> {
  // NextAuth JWT uses HS256 with the NEXTAUTH_SECRET
  const [headerB64, payloadB64, signatureB64] = token.split('.');
  if (!headerB64 || !payloadB64 || !signatureB64) throw new Error('Invalid token format');

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const data = encoder.encode(`${headerB64}.${payloadB64}`);
  const signature = Uint8Array.from(atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const valid = await crypto.subtle.verify('HMAC', key, signature, data);
  if (!valid) throw new Error('Invalid signature');

  const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');
  if (!payload.sub) throw new Error('Missing sub claim');

  return { sub: payload.sub };
}

export const authMiddleware = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(
  async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new HTTPException(401, { message: 'Missing or invalid Authorization header' });
    }
    const token = authHeader.slice(7);
    try {
      const { sub } = await verifyNextAuthJwt(token, c.env.NEXTAUTH_SECRET);
      c.set('userId', sub);
      await next();
    } catch {
      throw new HTTPException(401, { message: 'Invalid or expired token' });
    }
  }
);
