import { NextResponse } from 'next/server';
import { authenticateSellerKey } from '@/lib/seller-auth';
import { logApplicationEvent } from '@/lib/supabase/auth';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(request: Request) {
  // 1. Authenticate Seller Key
  const auth = await authenticateSellerKey(request);

  if (!auth.success) {
    return NextResponse.json(
      { success: false, error: auth.error, ...(auth.code ? { code: auth.code } : {}) },
      { status: auth.status }
    );
  }

  const { sellerKey, application } = auth.context;

  // 2. Rate Limiting (60 requests per minute per seller key)
  const rateLimit = checkRateLimit(`seller_${sellerKey.id}`, { limit: 60, windowMs: 60 * 1000 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: 'Rate limit exceeded. Please wait a moment before trying again.'
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.resetSeconds),
          'X-RateLimit-Limit': String(rateLimit.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateLimit.resetSeconds)
        }
      }
    );
  }

  // 3. Audit Logging
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    null;

  await logApplicationEvent({
    applicationId: application.id,
    event: 'SELLER_AUTH_VERIFIED',
    metadata: {
      sellerKeyId: sellerKey.id,
      sellerKeyName: sellerKey.name,
      sellerKeyPrefix: sellerKey.key_prefix,
      action: 'SELLER_AUTH_VERIFIED',
      success: true,
      timestamp: new Date().toISOString()
    },
    ipAddress
  });

  // 4. Return safe verified details (NEVER return complete seller key)
  return NextResponse.json(
    {
      success: true,
      application: {
        id: application.id,
        name: application.name
      },
      sellerKey: {
        name: sellerKey.name,
        status: sellerKey.status
      }
    },
    {
      status: 200,
      headers: {
        'X-RateLimit-Limit': String(rateLimit.limit),
        'X-RateLimit-Remaining': String(rateLimit.remaining)
      }
    }
  );
}
