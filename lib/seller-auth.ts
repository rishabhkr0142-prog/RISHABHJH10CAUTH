import { createAdminClient } from '@/lib/supabase/admin';
import { hashSecret, verifySecret } from '@/lib/crypto';
import type { SellerKey, Application } from '@/lib/supabase/types';

export interface AuthenticatedSellerContext {
  sellerKey: SellerKey;
  application: Application;
}

export type SellerAuthResult =
  | { success: true; context: AuthenticatedSellerContext }
  | { success: false; status: 401 | 500; error: string; code?: string };

/**
 * Server-side Seller Key Authenticator.
 *
 * Validates the seller key provided via the Authorization header or x-seller-key header,
 * securely verifies it against SHA-256 stored hash in `seller_keys`,
 * verifies the key is active, loads the attached application,
 * and updates `last_used_at`.
 */
export async function authenticateSellerKey(request: Request): Promise<SellerAuthResult> {
  try {
    const authHeader =
      request.headers.get('authorization') ||
      request.headers.get('Authorization');
    const customHeader = request.headers.get('x-seller-key');

    let rawKey = '';
    if (authHeader) {
      const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
      if (bearerMatch) {
        rawKey = bearerMatch[1].trim();
      } else {
        rawKey = authHeader.trim();
      }
    } else if (customHeader) {
      rawKey = customHeader.trim();
    }

    if (!rawKey) {
      return {
        success: false,
        status: 401,
        error: 'Invalid or revoked seller key'
      };
    }

    // SHA-256 hash of the supplied seller key
    const suppliedHash = hashSecret(rawKey);
    const admin = createAdminClient();

    // Query seller key by key_hash
    const { data: keyRecord, error: keyErr } = await admin
      .from('seller_keys')
      .select('*')
      .eq('key_hash', suppliedHash)
      .maybeSingle();

    if (keyErr) {
      if (
        keyErr.code === 'PGRST205' ||
        keyErr.message?.includes('schema cache') ||
        keyErr.message?.includes('does not exist')
      ) {
        return {
          success: false,
          status: 500,
          error:
            'Table "seller_keys" does not exist in Supabase. Please execute the migration in supabase/migrations/20260926150000_create_seller_keys.sql in your Supabase SQL Editor.',
          code: 'TABLE_MISSING'
        };
      }
      return {
        success: false,
        status: 401,
        error: 'Invalid or revoked seller key'
      };
    }

    // 1. Verify existence, active status, and not revoked
    if (!keyRecord || keyRecord.status !== 'active' || keyRecord.revoked_at !== null) {
      return {
        success: false,
        status: 401,
        error: 'Invalid or revoked seller key'
      };
    }

    // 2. Extra constant-time timing safe check on key_hash
    if (!verifySecret(rawKey, keyRecord.key_hash)) {
      return {
        success: false,
        status: 401,
        error: 'Invalid or revoked seller key'
      };
    }

    // 3. Load and verify attached Application
    const { data: appRecord, error: appErr } = await admin
      .from('applications')
      .select('*')
      .eq('id', keyRecord.application_id)
      .maybeSingle();

    if (appErr || !appRecord || appRecord.status !== 'active') {
      return {
        success: false,
        status: 401,
        error: 'Invalid or revoked seller key'
      };
    }

    // 4. Update last_used_at timestamp on seller_keys asynchronously
    const nowIso = new Date().toISOString();
    await admin
      .from('seller_keys')
      .update({ last_used_at: nowIso })
      .eq('id', keyRecord.id);

    return {
      success: true,
      context: {
        sellerKey: {
          ...keyRecord,
          last_used_at: nowIso
        } as SellerKey,
        application: appRecord as Application
      }
    };
  } catch (err: any) {
    console.error('[SellerAuth] Internal error during verification:', err);
    return {
      success: false,
      status: 401,
      error: 'Invalid or revoked seller key'
    };
  }
}
