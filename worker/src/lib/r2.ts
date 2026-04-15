export async function uploadToR2(
  bucket: R2Bucket,
  userId: string,
  imageBytes: ArrayBuffer,
  ext: string = 'jpg'
): Promise<string> {
  const key = `images/${userId}/${crypto.randomUUID()}.${ext}`;
  await bucket.put(key, imageBytes, {
    httpMetadata: { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}` },
  });
  return key;
}

export async function getFromR2(bucket: R2Bucket, key: string): Promise<R2ObjectBody | null> {
  return bucket.get(key);
}
