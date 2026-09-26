import { NextResponse } from 'next/server';
import { getOwnerUser, logApplicationEvent } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  generateUniqueLicenses,
  calculateExpiryDate,
  MAX_GENERATION_AMOUNT
} from '@/lib/license-generator';
import { generateLicensesService } from '@/lib/license-service';
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

    if (!applicationId) {
      return NextResponse.json({ error: 'Application ID is required' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Verify application exists and belongs to this owner
    const { data: appRecord, error: appErr } = await admin
      .from('applications')
      .select('id, name, owner_id')
      .eq('id', applicationId)
      .maybeSingle();

    if (appErr || !appRecord) {
      return NextResponse.json({ error: 'Target application not found' }, { status: 404 });
    }

    if (appRecord.owner_id !== auth.profile.id) {
      return NextResponse.json(
        { error: 'You do not have permission to generate licenses for this application' },
        { status: 403 }
      );
    }

    // Call shared license generation service
    const generationResult = await generateLicensesService({
      applicationId,
      subscription,
      mask,
      amount,
      subscriptionLength: lengthVal,
      subscriptionUnit: lengthUnit as any,
      charSets: { lowercase, uppercase, numbers },
      note,
      allowedDevices
    });

    // Log audit event
    await logApplicationEvent({
      applicationId,
      event: 'licenses.generated',
      metadata: {
        count: generationResult.count,
        subscription,
        mask,
        expiresAt: generationResult.expiresAt,
        allowedDevices,
        hasNote: Boolean(note)
      }
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Licenses Generated Successfully',
        count: generationResult.count,
        generatedKeys: generationResult.generatedKeys,
        licenses: generationResult.licenses.map((lic) => ({
          ...lic,
          application: { id: appRecord.id, name: appRecord.name }
        }))
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[API Licenses POST] Error:', err);
    const status = err.statusCode || 500;
    return NextResponse.json(
      {
        error: err.message || 'Internal server error during license generation',
        ...(err.code ? { code: err.code } : {})
      },
      { status }
    );
  }
}
