export type ProductData = {
  name: string;
  price: number;      // in VND (Shopee stores price * 100000)
  imageUrl: string;
};

export function isShopeeUrl(url: string): boolean {
  return /shopee\.(vn|sg|co\.id|ph|com\.my|co\.th)/.test(url);
}

export async function fetchShopeeProduct(url: string): Promise<ProductData | null> {
  // Extract shopId and itemId from URL pattern: /i.SHOPID.ITEMID
  const match = url.match(/i\.(\d+)\.(\d+)/);
  if (!match) return null;

  const [, shopId, itemId] = match;
  const domain = url.match(/shopee\.[a-z.]+/)?.[0] ?? 'shopee.vn';
  const apiUrl = `https://${domain}/api/v4/item/get?itemid=${itemId}&shopid=${shopId}`;

  const res = await fetch(apiUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': `https://${domain}`,
      'Accept': 'application/json',
    },
  });

  if (!res.ok) return null;

  const json = await res.json<{ data?: { item?: { name?: string; price?: number; images?: string[] } } }>();
  const item = json?.data?.item;
  if (!item) return null;

  const imageHash = item.images?.[0];
  if (!imageHash) return null;

  return {
    name: item.name ?? '',
    price: (item.price ?? 0) / 100000,  // Shopee stores price * 100000
    imageUrl: `https://cf.shopee.vn/file/${imageHash}`,
  };
}
