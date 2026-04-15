import { NextRequest, NextResponse } from 'next/server';

const WORKER_URL = process.env.WORKER_URL ?? '';

async function proxyRequest(req: NextRequest, path: string[]) {
  // NextAuth v5 stores the JWT in a cookie named 'authjs.session-token'
  const sessionToken = req.cookies.get('authjs.session-token')?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workerPath = '/' + path.join('/');
  const workerUrl = `${WORKER_URL}${workerPath}`;

  const forwardHeaders = new Headers();
  forwardHeaders.set('Authorization', `Bearer ${sessionToken}`);

  const contentType = req.headers.get('content-type');
  if (contentType) forwardHeaders.set('Content-Type', contentType);

  const workerRes = await fetch(workerUrl, {
    method: req.method,
    headers: forwardHeaders,
    body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
    // @ts-expect-error duplex is required for streaming body in Node.js fetch
    duplex: 'half',
  });

  return new Response(workerRes.body, {
    status: workerRes.status,
    headers: workerRes.headers,
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyRequest(req, path);
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyRequest(req, path);
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyRequest(req, path);
}
