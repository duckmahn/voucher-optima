// Regression test against Auth.js's real JWE format for NextAuth v5 session cookies.
// verify-session-token.ts reverse-engineers Auth.js's internal (undocumented) key
// derivation scheme; this test catches drift if a future next-auth bump changes it.
// The pinned `next-auth` devDependency here must be kept in sync with the root
// project's `next-auth` version (see /package.json) for that guarantee to hold.
//
// Run with `npm test`. Requires Node >=22.6 (native TypeScript execution) to import
// verify-session-token.ts directly — matches how `wrangler dev`/`deploy` also consume
// the .ts source without a separate build step.
import assert from 'node:assert/strict';
import { encode } from 'next-auth/jwt';
import { verifyNextAuthSessionToken } from './verify-session-token.ts';

const SECRET = `test-secret-${crypto.randomUUID()}`;

async function run() {
  const httpToken = await encode({
    token: { sub: 'user-http' },
    secret: SECRET,
    salt: 'authjs.session-token',
  });
  const httpsToken = await encode({
    token: { sub: 'user-https' },
    secret: SECRET,
    salt: '__Secure-authjs.session-token',
  });

  const { sub: subHttp } = await verifyNextAuthSessionToken(httpToken, SECRET);
  assert.equal(subHttp, 'user-http', 'HTTP-salted token should decode without a hint (fallback path)');

  const { sub: subHttps } = await verifyNextAuthSessionToken(httpsToken, SECRET);
  assert.equal(subHttps, 'user-https', 'HTTPS-salted token should decode without a hint (fallback path)');

  const { sub: subHinted } = await verifyNextAuthSessionToken(
    httpsToken,
    SECRET,
    '__Secure-authjs.session-token'
  );
  assert.equal(subHinted, 'user-https', 'token should decode using an explicit cookie-name hint');

  await assert.rejects(
    () => verifyNextAuthSessionToken(httpToken, 'wrong-secret'),
    'wrong secret should be rejected'
  );

  await assert.rejects(
    () => verifyNextAuthSessionToken(httpToken, SECRET, '__Secure-authjs.session-token'),
    'a hint that does not match the salt the token was encrypted with should be rejected, not silently retried'
  );

  const tampered = `${httpToken.slice(0, -4)}abcd`;
  await assert.rejects(
    () => verifyNextAuthSessionToken(tampered, SECRET),
    'tampered token should be rejected'
  );

  console.log('verify-session-token: all checks passed');
}

run().catch((err) => {
  console.error('verify-session-token test FAILED:', err);
  process.exitCode = 1;
});
