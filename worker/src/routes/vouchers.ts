import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { Bindings } from '../index';

type Variables = { userId: string };

export const vouchersRoute = new Hono<{ Bindings: Bindings; Variables: Variables }>();

vouchersRoute.get('/', async (c) => {
  const userId = c.get('userId');
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM vouchers WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(userId).all();
  return c.json(results);
});

vouchersRoute.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{
    percentage: number;
    min_condition: number;
    max_discount: number;
    code?: string;
    product_name?: string;
    product_price?: number;
    product_url?: string;
    product_image?: string;
  }>();

  const { percentage, min_condition, max_discount } = body;
  if (!percentage || !min_condition || !max_discount) {
    throw new HTTPException(400, { message: 'percentage, min_condition, max_discount are required' });
  }

  const result = await c.env.DB.prepare(`
    INSERT INTO vouchers (user_id, percentage, min_condition, max_discount, code, product_name, product_price, product_url, product_image)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `).bind(
    userId, percentage, min_condition, max_discount,
    body.code ?? null, body.product_name ?? null,
    body.product_price ?? null, body.product_url ?? null, body.product_image ?? null
  ).first();

  return c.json(result, 201);
});

vouchersRoute.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const { meta } = await c.env.DB.prepare(
    'DELETE FROM vouchers WHERE id = ? AND user_id = ?'
  ).bind(id, userId).run();

  if (meta.changes === 0) throw new HTTPException(404, { message: 'Voucher not found' });
  return c.json({ deleted: true });
});
