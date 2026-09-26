import { NextResponse } from 'next/server';
import { getOwnerUser, logApplicationEvent } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  generateUniqueLicenses,
  calculateExpiryDate,
  MAX_GENERATION_AMOUNT
} from '@/lib/license-generator';
import { isValidSubscription } from '@/lib/subscriptions';
import type { License, LicenseStatus } from '@/lib/supabase/types';

export async function GET(request: Request) {
  const auth = await getOwnerUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const applicationId = searchParams.get('application_id')?.trim();
  const status = searchParams.get('status')?.trim().toLowerCase();
  const subscription = searchParams.get('subscription')?.trim().toLowerCase();
  const search = searchParams.get('search')?.trim();
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
  const offset = (page - 1) * limit;

  const admin = createAdminClient();

  // 1. Fetch all applications owned by this owner
  const { data: apps, error: appErr } = await admin
    .from('applications')
    .select('id, name, client_id')
    .eq('owner_id', auth.profile.id);

  if (appErr) {
    return NextResponse.json({ error: appErr.message }, { status: 500 });
  }

  const appMap = new Map((apps || []).map((a) => [a.id, a]));
  const ownedAppIds = (apps || []).map((a) => a.id);

  if (ownedAppIds.length === 0) {
    return NextResponse.json({
      licenses: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
      applications: []
    });
  }

  // If specific application requested, verify ownership
  let targetAppIds: string[] = ownedAppIds;
  if (applicationId && applicationId !== 'all') {
    if (!appMap.has(applicationId)) {
      return NextResponse.json(
        { error: 'Application not found or unauthorized access' },
        { status: 403 }
      );
    }
    targetAppIds = [applicationId];
  }

  try {
    let query = admin
      .from('licenses')
      .select('*', { count: 'exact' })
      .in('application_id', targetAppIds)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status as LicenseStatus);
    }

    if (subscription && subscription !== 'all') {
      query = query.eq('subscription', subscription);
    }

    if (search) {
      query = query.or(`license_key.ilike.%${search}%,note.ilike.%${search}%`);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: licenseRows, count, error: licenseErr } = await query;

    if (licenseErr) {
      console.error('[API Licenses GET] Database error:', licenseErr);
      if (
        licenseErr.code === 'PGRST205' ||
        licenseErr.message?.includes('schema cache') ||
        licenseErr.message?.includes('does not exist')
      ) {
        return NextResponse.json(
          {
            error:
              'Table "licenses" does not exist in Supabase. Please execute the migration in supabase/migrations/20260926140000_create_licenses.sql in your Supabase SQL Editor.',
            code: 'TABLE_MISSING',
            migrationFile: 'supabase/migrations/20260926140000_create_licenses.sql'
          },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: 'Unable to load licenses. Please try again.' },
        { status: 500 }
      );
    }

    const totalCount = count || 0;
    const now = new Date();

    // Enrich with application info and lazily flag expired licenses
    const enrichedLicenses = (licenseRows || []).map((lic: License) => {
      let currentStatus = lic.status;
      if (
        currentStatus === 'active' &&
        lic.expires_at &&
        new Date(lic.expires_at) < now
      ) {
        currentStatus = 'expired';
      }

      return {
        ...lic,
        status: currentStatus,
        application: appMap.get(lic.application_id) || null
      };
    });

    return NextResponse.json({
      licenses: enrichedLicenses,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      applications: apps || []
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await getOwnerUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const applicationId = body.application_id || body.applicationId;
    const subscription = (body.subscription || '').trim();
    const mask = (body.mask || body.license_mask || '').trim();
    const amount = parseInt(body.amount, 10);
    const lengthVal = parseInt(body.subscription_length || body.subscriptionLength || body.duration, 10);
    const lengthUnit = (body.subscription_unit || body.subscriptionUnit || body.durationUnit || 'days').toLowerCase();
    const note = body.note ? String(body.note).trim() : null;
    const allowedDevices = Math.max(1, parseInt(body.allowed_devices || body.allowedDevices || '1', 10));

    // Character set options
    const rawCharSets = body.char_sets || body.characterSet || body.charSets || {};
    let lowercase = false;
    let uppercase = false;
    let numbers = false;

    if (Array.isArray(rawCharSets)) {
      lowercase = rawCharSets.includes('lowercase') || rawCharSets.includes('az');
      uppercase = rawCharSets.includes('uppercase') || rawCharSets.includes('AZ');
      numbers = rawCharSets.includes('numbers') || rawCharSets.includes('0-9');
    } else if (typeof rawCharSets === 'object') {
      lowercase = Boolean(rawCharSets.lowercase || rawCharSets.az);
      uppercase = Boolean(rawCharSets.uppercase || rawCharSets.AZ);
      numbers = Boolean(rawCharSets.numbers || rawCharSets['0-9']);
    }

    // 1. Validation
    if (!applicationId) {
      return NextResponse.json(
        { error: 'Application ID is required' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Verify application exists and belongs to this owner
    const { data: appRecord, error: appErr } = await admin
      .from('applications')
      .select('id, name, owner_id')
      .eq('id', applicationId)
      .maybeSingle();

    if (appErr || !appRecord) {
      return NextResponse.json(
        { error: 'Target application not found' },
        { status: 404 }
      );
    }

    if (appRecord.owner_id !== auth.profile.id) {
      return NextResponse.json(
        { error: 'You do not have permission to generate licenses for this application' },
        { status: 403 }
      );
    }

    // Verify subscription
    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription is required' },
        { status: 400 }
      );
    }

    // Amount validation
    if (isNaN(amount) || amount < 1) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }

    if (amount > MAX_GENERATION_AMOUNT) {
      return NextResponse.json(
        { error: `Amount cannot exceed ${MAX_GENERATION_AMOUNT} licenses per generation batch` },
        { status: 400 }
      );
    }

    // Mask validation
    if (!mask) {
      return NextResponse.json(
        { error: 'License Mask is required (e.g. JH10C-XXXX-XXXX)' },
        { status: 400 }
      );
    }

    if (!/X/i.test(mask)) {
      return NextResponse.json(
        { error: 'License Mask must contain at least one "X" character placeholder' },
        { status: 400 }
      );
    }

    // Subscription length validation
    if (isNaN(lengthVal) || lengthVal <= 0) {
      return NextResponse.json(
        { error: 'Subscription length must be a positive number' },
        { status: 400 }
      );
    }

    const validUnits = ['hours', 'days', 'months', 'years'];
    if (!validUnits.includes(lengthUnit)) {
      return NextResponse.json(
        { error: 'Subscription length unit must be Days, Hours, Months, or Years' },
        { status: 400 }
      );
    }

    // Character set validation
    if (!lowercase && !uppercase && !numbers) {
      return NextResponse.json(
        { error: 'At least one character set (az Lowercase, AZ Uppercase, or 0-9 Numbers) must be selected' },
        { status: 400 }
      );
    }

    // Allowed devices validation
    if (isNaN(allowedDevices) || allowedDevices < 1 || allowedDevices > 1000) {
      return NextResponse.json(
        { error: 'Allowed devices must be a number between 1 and 1000' },
        { status: 400 }
      );
    }

    // 2. Expiry calculation
    const expiresAt = calculateExpiryDate(lengthVal, lengthUnit as any);

    // 3. Query existing license keys for collision prevention
    const { data: existingRows, error: lookupErr } = await admin
      .from('licenses')
      .select('license_key');

    if (lookupErr) {
      if (
        lookupErr.code === 'PGRST205' ||
        lookupErr.message?.includes('schema cache') ||
        lookupErr.message?.includes('does not exist')
      ) {
        return NextResponse.json(
          {
            error:
              'Table "licenses" does not exist in Supabase. Please execute the migration in supabase/migrations/20260926140000_create_licenses.sql in your Supabase SQL Editor.',
            code: 'TABLE_MISSING',
            migrationFile: 'supabase/migrations/20260926140000_create_licenses.sql'
          },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: `Database error checking existing licenses: ${lookupErr.message}` },
        { status: 500 }
      );
    }

    const existingKeySet = new Set((existingRows || []).map((r) => r.license_key));

    // 4. Generate unique keys
    const generatedKeys = generateUniqueLicenses({
      mask,
      amount,
      charSets: { lowercase, uppercase, numbers },
      existingKeys: existingKeySet
    });

    const nowIso = new Date().toISOString();

    // 5. Build insert records
    const insertPayload = generatedKeys.map((key) => ({
      application_id: applicationId,
      license_key: key,
      subscription: subscription,
      status: 'active' as LicenseStatus,
      allowed_devices: allowedDevices,
      used_devices: 0,
      device_hwids: [],
      note: note || null,
      expires_at: expiresAt,
      created_at: nowIso,
      updated_at: nowIso
    }));

    // 6. Insert batch into database
    const { data: insertedRecords, error: insertErr } = await admin
      .from('licenses')
      .insert(insertPayload)
      .select();

    if (insertErr || !insertedRecords) {
      console.error('[API Licenses POST] Database insertion error:', insertErr);
      return NextResponse.json(
        { error: insertErr?.message || 'Failed to save generated licenses' },
        { status: 500 }
      );
    }

    // 7. Log audit event (without exposing complete license keys in logs)
    await logApplicationEvent({
      applicationId: applicationId,
      event: 'licenses.generated',
      metadata: {
        count: generatedKeys.length,
        subscription,
        mask,
        expiresAt,
        allowedDevices,
        hasNote: Boolean(note)
      }
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Licenses Generated Successfully',
        count: generatedKeys.length,
        generatedKeys,
        licenses: (insertedRecords as License[]).map((lic) => ({
          ...lic,
          application: { id: appRecord.id, name: appRecord.name }
        }))
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[API Licenses POST] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error during license generation' },
      { status: 500 }
    );
  }
}
