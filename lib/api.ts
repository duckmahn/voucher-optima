// Client-side fetch wrapper — routes through Next.js proxy at /api/proxy
// which attaches the NextAuth JWT server-side before forwarding to the Worker.
export async function apiFetchClient(
  path: string,
  options?: RequestInit
): Promise<Response> {
  return fetch(`/api/proxy${path}`, options);
}
