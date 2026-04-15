import { ProductData } from './shopee';

function extractMeta(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function fetchOgProduct(url: string): Promise<Partial<ProductData> | null> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Accept': 'text/html',
    },
  });

  if (!res.ok) return null;

  const html = await res.text();

  const imageUrl = extractMeta(html, 'og:image') ?? extractMeta(html, 'twitter:image');
  const name = extractMeta(html, 'og:title') ?? extractMeta(html, 'twitter:title');

  if (!imageUrl) return null;

  return { name: name ?? undefined, imageUrl };
}
