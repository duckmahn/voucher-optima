import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { Bindings } from '../index';
import { uploadToR2, getFromR2 } from '../lib/r2';

type Variables = { userId: string };

export const imagesRoute = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Manual upload (auth required — set in index.ts middleware)
imagesRoute.post('/upload', async (c) => {
  const userId = c.get('userId');
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  if (!file) throw new HTTPException(400, { message: 'file is required' });

  const bytes = await file.arrayBuffer();
  const ext = file.type.includes('png') ? 'png' : file.type.includes('webp') ? 'webp' : 'jpg';
  const imageKey = await uploadToR2(c.env.R2, userId, bytes, ext);

  return c.json({ imageKey }, 201);
});

// Serve image (no auth needed — keys are unguessable UUIDs)
imagesRoute.get('/:key{.+}', async (c) => {
  const key = c.req.param('key');
  const object = await getFromR2(c.env.R2, key);
  if (!object) throw new HTTPException(404, { message: 'Image not found' });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  return new Response(object.body, { headers });
});
