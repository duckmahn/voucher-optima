const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? '';

// Client-side fetch — use in "use client" components
// Pass a getToken function that returns the JWT string from the NextAuth session
export async function apiFetchClient(
  path: string,
  getToken: () => Promise<string | null>,
  options?: RequestInit
): Promise<Response> {
  const token = await getToken();
  return fetch(`${WORKER_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers as Record<string, string> ?? {}),
    },
  });
}
