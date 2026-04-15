import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { vouchersRoute } from './routes/vouchers';
import { comparisonsRoute } from './routes/comparisons';
import { productRoute } from './routes/product';
import { imagesRoute } from './routes/images';
import { authMiddleware } from './middleware/auth';

export type Bindings = {
  DB: D1Database;
  R2: R2Bucket;
  NEXTAUTH_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors({ origin: '*', allowHeaders: ['Authorization', 'Content-Type'] }));
app.use('/vouchers/*', authMiddleware);
app.use('/comparisons/*', authMiddleware);
app.use('/product/*', authMiddleware);
app.use('/images/upload', authMiddleware);

app.route('/vouchers', vouchersRoute);
app.route('/comparisons', comparisonsRoute);
app.route('/product', productRoute);
app.route('/images', imagesRoute);

app.get('/health', (c) => c.json({ ok: true }));

export default app;
