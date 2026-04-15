import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { Bindings } from '../index';
import { isShopeeUrl, fetchShopeeProduct } from '../lib/shopee';
import { fetchOgProduct } from '../lib/og';
import { uploadToR2 } from '../lib/r2';

type Variables = { userId: string };

export const productRoute = new Hono<{ Bindings: Bindings; Variables: Variables }>();

productRoute.post('/fetch', async (c) => {
  const { url } = await c.req.json<{ url: string }>();
  if (!url) throw new HTTPException(400, { message: 'url is required' });

  const userId = c.get('userId');

  // 1. Fetch product data
  let productData: { name?: string; price?: number; imageUrl?: string } | null = null;

  if (isShopeeUrl(url)) {
    productData = await fetchShopeeProduct(url);
  }
  if (!productData) {
    productData = await fetchOgProduct(url);
  }
  if (!productData?.imageUrl) {
    return c.json({ name: productData?.name ?? null, price: productData?.price ?? null, imageKey: null });
  }

  // 2. Download image and upload to R2
  let imageKey: string | null = null;
  try {
    const imgRes = await fetch(productData.imageUrl);
    if (imgRes.ok) {
      const bytes = await imgRes.arrayBuffer();
      const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
      const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
      imageKey = await uploadToR2(c.env.R2, userId, bytes, ext);
    }
  } catch {
    // Image upload failure is non-fatal — return what we have
  }

  return c.json({
    name: productData.name ?? null,
    price: productData.price ?? null,
    imageKey,
  });
});
