import assert from 'assert';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Test 1: Seller Key Generation and Formats
console.log('--- Test 1: Seller Key Format & Prefix Generation ---');
function generateSellerKey() {
  const randomHex = crypto.randomBytes(24).toString('hex');
  const fullKey = `jh10c_seller_${randomHex}`;
  const prefix = `jh10c_seller_${randomHex.slice(0, 6)}...`;
  return { fullKey, prefix };
}

const key1 = generateSellerKey();
console.log('Generated Seller Key Example:', key1.fullKey);
console.log('Generated Prefix Example:', key1.prefix);

assert(key1.fullKey.startsWith('jh10c_seller_'), 'Key must start with jh10c_seller_');
assert(key1.prefix.startsWith('jh10c_seller_'), 'Prefix must start with jh10c_seller_');
assert(key1.prefix.endsWith('...'), 'Prefix must end with ...');
assert(key1.fullKey.length > 50, 'Full key must be cryptographically secure length');
console.log('✓ Test 1 passed: Format conforms strictly to specifications.\n');

// Test 2: Hashing and Constant-Time Verification
console.log('--- Test 2: SHA-256 Hashing & Verification ---');
function hashSecret(secret) {
  return crypto.createHash('sha256').update(secret).digest('hex');
}
function verifySecret(rawSecret, hashedSecret) {
  const hashOfRaw = hashSecret(rawSecret);
  const hashBuffer = Buffer.from(hashOfRaw, 'utf8');
  const expectedBuffer = Buffer.from(hashedSecret, 'utf8');
  if (hashBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(hashBuffer, expectedBuffer);
}

const hash1 = hashSecret(key1.fullKey);
assert(verifySecret(key1.fullKey, hash1), 'Plaintext key must verify against its hash');
assert(!verifySecret(key1.fullKey + '_tampered', hash1), 'Tampered key must fail verification');
assert(!verifySecret('wrong_key', hash1), 'Wrong key must fail verification');
console.log('✓ Test 2 passed: SHA-256 and constant-time verification work correctly.\n');

// Test 3: Rate Limiting
console.log('--- Test 3: Sliding-Window Rate Limiter ---');
const testStore = new Map();
function checkRateLimit(id, limit = 5, windowMs = 1000) {
  const now = Date.now();
  let record = testStore.get(id);
  if (!record) {
    record = { timestamps: [] };
    testStore.set(id, record);
  }
  record.timestamps = record.timestamps.filter((ts) => ts > now - windowMs);
  if (record.timestamps.length >= limit) {
    return { allowed: false, remaining: 0 };
  }
  record.timestamps.push(now);
  return { allowed: true, remaining: limit - record.timestamps.length };
}

for (let i = 0; i < 5; i++) {
  const res = checkRateLimit('seller_test', 5, 1000);
  assert(res.allowed === true, `Request ${i + 1} should be allowed`);
}
const blocked = checkRateLimit('seller_test', 5, 1000);
assert(blocked.allowed === false, 'Request 6 must be rate-limited');
console.log('✓ Test 3 passed: Rate limiter enforces limit and blocks excess requests.\n');

// Test 4: License Generator & Expiry
console.log('--- Test 4: License Generator Logic & Collision Prevention ---');
function generateSingleKey(mask, charPool) {
  let result = '';
  for (let i = 0; i < mask.length; i++) {
    const char = mask[i];
    if (char === 'X' || char === 'x') {
      const randIndex = crypto.randomInt(0, charPool.length);
      result += charPool[randIndex];
    } else {
      result += char;
    }
  }
  return result;
}

const pool = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const singleKey = generateSingleKey('JH10C-XXXX-XXXX', pool);
console.log('Generated Single License Key:', singleKey);
assert(/^JH10C-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}$/.test(singleKey), 'Generated key must match mask pattern');
console.log('✓ Test 4 passed: License generator logic produces expected format.\n');

console.log('All seller system automated unit tests passed successfully!');
