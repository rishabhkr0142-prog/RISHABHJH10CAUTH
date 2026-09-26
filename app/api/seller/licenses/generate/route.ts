import { NextResponse } from 'next/server';
import { authenticateSellerKey } from '@/lib/seller-auth';
import { generateLicensesService, LicenseGenerationError } from '@/lib/license-service';
import { logApplicationEvent } from '@/lib/supabase/auth';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  // 1. Authenticate Seller Key
  const auth = await authenticateSellerKey(request);

  if (!auth.success) {
    return NextResponse.json(
      {
        success: false,
        error: auth.error,
        ...(auth.code ? { code: auth.code } : {})
      },
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

  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    null;

  try {
    // 3. Parse Request Body
    const body = await request.json().catch(() => ({}));

    // Extract parameters supporting camelCase and snake_case naming conventions
    const subscription = (body.subscription || body.subscriptionId || body.tier || '').trim();
    const mask = (body.mask || body.licenseMask || body.license_mask || '').trim();
    const amount = parseInt(body.amount ?? body.count ?? '1', 10);
    const subscriptionLength = parseInt(
      body.subscriptionLength ??
        body.subscription_length ??
        body.duration ??
        body.expiryDays ??
        '30',
      10
    );
    const subscriptionUnit = (
      body.subscriptionUnit ??
      body.subscription_unit ??
      body.durationUnit ??
      'days'
    ).toLowerCase();
    const note = body.note ? String(body.note).trim() : 'Seller API Generated';
    const allowedDevices = Math.max(
      1,
      parseInt(body.allowedDevices ?? body.allowed_devices ?? '1', 10)
    );

    // Normalize character set options
    const rawCharSets = body.characterSet || body.charSets || body.char_sets || {};
    let lowercase = false;
    let uppercase = false;
    let numbers = false;

    if (Array.isArray(rawCharSets)) {
      lowercase = rawCharSets.includes('lowercase') || rawCharSets.includes('az');
      uppercase = rawCharSets.includes('uppercase') || rawCharSets.includes('AZ');
      numbers = rawCharSets.includes('numbers') || rawCharSets.includes('0-9');
    } else if (typeof rawCharSets === 'object' && rawCharSets !== null) {
      // Default to true if caller passes an empty object or omitted characterSet
      const hasAnyKeys = Object.keys(rawCharSets).length > 0;
      if (!hasAnyKeys) {
        lowercase = true;
        uppercase = true;
        numbers = true;
      } else {
        lowercase = Boolean(rawCharSets.lowercase || rawCharSets.az);
        uppercase = Boolean(rawCharSets.uppercase || rawCharSets.AZ);
        numbers = Boolean(rawCharSets.numbers || rawCharSets['0-9']);
      }
    } else {
      // Default standard alphanumeric pool
      lowercase = true;
      uppercase = true;
      numbers = true;
    }

    // 4. CRITICAL: applicationId is ALWAYS derived strictly from the authenticated Seller Key
    // Never trust an applicationId supplied by the client/bot.
    const applicationId = application.id;

    // 5. Call the shared server-side license generation service
    const generationResult = await generateLicensesService({
      applicationId,
      subscription,
      mask,
      amount,
      subscriptionLength,
      subscriptionUnit: subscriptionUnit as any,
      charSets: { lowercase, uppercase, numbers },
      note,
      allowedDevices
    });

    // 6. Audit Logging (Requirement 12)
    // Safe request information, NEVER storing complete seller keys
    await logApplicationEvent({
      applicationId,
      event: 'SELLER_LICENSE_GENERATED',
      metadata: {
        sellerKeyId: sellerKey.id,
        sellerKeyName: sellerKey.name,
        sellerKeyPrefix: sellerKey.key_prefix,
        action: 'SELLER_LICENSE_GENERATED',
        success: true,
        timestamp: new Date().toISOString(),
        requestSummary: {
          subscription,
          mask,
          amount,
          subscriptionLength,
          subscriptionUnit,
          allowedDevices,
          count: generationResult.count
        }
      },
      ipAddress
    });

    // 7. Format Clean Success Response (Requirement 7)
    return NextResponse.json(
      {
        success: true,
        applicationId,
        licenses: generationResult.licenses.map((lic) => ({
          licenseKey: lic.license_key,
          subscription: lic.subscription,
          expiresAt: lic.expires_at
        }))
      },
      {
        status: 201,
        headers: {
          'X-RateLimit-Limit': String(rateLimit.limit),
          'X-RateLimit-Remaining': String(rateLimit.remaining)
        }
      }
    );
  } catch (err: any) {
    // Audit failure record
    await logApplicationEvent({
      applicationId: application.id,
      event: 'SELLER_LICENSE_GENERATION_FAILED',
      metadata: {
        sellerKeyId: sellerKey.id,
        sellerKeyName: sellerKey.name,
        sellerKeyPrefix: sellerKey.key_prefix,
        action: 'SELLER_LICENSE_GENERATED',
        success: false,
        timestamp: new Date().toISOString(),
        errorMessage: err.message || 'Unknown error'
      },
      ipAddress
    });

    // Handle known LicenseGenerationError
    if (err instanceof LicenseGenerationError) {
      return NextResponse.json(
        {
          success: false,
          error: err.message
        },
        { status: err.statusCode }
      );
    }

    console.error('[SellerLicenseGenerate] Unexpected error:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'An internal error occurred while generating licenses'
      },
      { status: 500 }
    );
  }
}
