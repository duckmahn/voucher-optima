import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { Bindings } from '../index';

type Variables = { userId: string };

export const comparisonsRoute = new Hono<{ Bindings: Bindings; Variables: Variables }>();

comparisonsRoute.get('/', async (c) => {
  const userId = c.get('userId');
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM saved_comparisons WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(userId).all();
  return c.json(results.map(r => ({ ...r, data: JSON.parse(r.data as string) })));
});

comparisonsRoute.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  if (!body || typeof body !== 'object') {
    throw new HTTPException(400, { message: 'Request body required' });
  }

  const result = await c.env.DB.prepare(
    'INSERT INTO saved_comparisons (user_id, data) VALUES (?, ?) RETURNING *'
  ).bind(userId, JSON.stringify(body)).first();

  return c.json({ ...result, data: body }, 201);
});

comparisonsRoute.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const { meta } = await c.env.DB.prepare(
    'DELETE FROM saved_comparisons WHERE id = ? AND user_id = ?'
  ).bind(id, userId).run();

  if (meta.changes === 0) throw new HTTPException(404, { message: 'Comparison not found' });
  return c.json({ deleted: true });
});
