import crypto from 'crypto';
import bcrypt from 'bcryptjs';

/**
 * Hash end user password using bcrypt with salt rounds 10
 */
export async function hashUserPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verify end user password against bcrypt hash
 */
export async function verifyUserPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate cryptographically secure Client ID

 * Format: jh10c_client_<32 hex chars>
 */
export function generateClientId(): string {
  return `jh10c_client_${crypto.randomBytes(16).toString('hex')}`;
}

/**
 * Generate cryptographically secure Client Secret
 * Format: jh10c_sec_<48 hex chars>
 */
export function generateClientSecret(): string {
  return `jh10c_sec_${crypto.randomBytes(24).toString('hex')}`;
}

/**
 * Generate cryptographically secure API Key
 * Format: jh10c_key_<48 hex chars>
 */
export function generateApiKey(): { fullKey: string; prefix: string } {
  const randomHex = crypto.randomBytes(24).toString('hex');
  const fullKey = `jh10c_key_${randomHex}`;
  const prefix = `jh10c_key_${randomHex.slice(0, 6)}...`;
  return { fullKey, prefix };
}

/**
 * Generate cryptographically secure Webhook Secret
 * Format: whsec_<40 hex chars>
 */
export function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(20).toString('hex')}`;
}

/**
 * Hash secret or key with SHA-256 for secure DB storage
 */
export function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

/**
 * Verify secret against hashed secret with constant-time comparison
 */
export function verifySecret(rawSecret: string, hashedSecret: string): boolean {
  const hashOfRaw = hashSecret(rawSecret);
  const hashBuffer = Buffer.from(hashOfRaw, 'utf8');
  const expectedBuffer = Buffer.from(hashedSecret, 'utf8');

  if (hashBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(hashBuffer, expectedBuffer);
}
