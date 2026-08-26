import { jwtDecrypt } from 'jose';

const CONTENT_ENC_ALG = 'A256CBC-HS512';

// Auth.js (NextAuth v5) encrypts JWT session cookies as a JWE ("dir" key management,
// A256CBC-HS512 content encryption) rather than signing a plain JWS. The decryption key
// is derived via HKDF-SHA256 from the app secret, salted with the session cookie's name.
// See @auth/core/jwt.ts's getDerivedEncryptionKey for the reference implementation.
async function deriveEncryptionKey(secret: string, salt: string): Promise<Uint8Array> {
  const info = `Auth.js Generated Encryption Key (${salt})`;
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'HKDF',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode(salt),
      info: new TextEncoder().encode(info),
    },
    keyMaterial,
    64 * 8 // 64 bytes required for A256CBC-HS512
  );
  return new Uint8Array(bits);
}

// Auth.js names the session cookie 'authjs.session-token' over HTTP and
// '__Secure-authjs.session-token' over HTTPS — and the cookie name IS the salt used to
// derive the encryption key. The proxy tells us which one it read via cookieNameHint
// (the common case: one derive+decrypt). Without a hint we try both; a wrong salt derives
// a different key and jwtDecrypt fails closed (AEAD tag check), so this can't false-accept.
const SESSION_COOKIE_SALTS = ['authjs.session-token', '__Secure-authjs.session-token'] as const;

export async function verifyNextAuthSessionToken(
  token: string,
  secret: string,
  cookieNameHint?: string
): Promise<{ sub: string }> {
  const salts = cookieNameHint ? [cookieNameHint] : SESSION_COOKIE_SALTS;
  let lastError: unknown;
  for (const salt of salts) {
    try {
      const encryptionKey = await deriveEncryptionKey(secret, salt);
      const { payload } = await jwtDecrypt(token, encryptionKey, {
        keyManagementAlgorithms: ['dir'],
        // Auth.js v5's encode() hardcodes A256CBC-HS512 (not configurable) — deriveEncryptionKey
        // only computes the correct 64-byte key length for that algorithm, so only allow it.
        contentEncryptionAlgorithms: [CONTENT_ENC_ALG],
      });
      if (typeof payload.sub !== 'string' || !payload.sub) {
        throw new Error('Missing sub claim');
      }
      return { sub: payload.sub };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Invalid session token');
}
