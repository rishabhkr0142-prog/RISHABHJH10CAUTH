import { NextResponse } from 'next/server';
import { getOwnerUser, logApplicationEvent } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';
import { hashUserPassword } from '@/lib/crypto';
import { generateUniqueLicenses } from '@/lib/license-generator';
import { AVAILABLE_SUBSCRIPTIONS } from '@/lib/subscriptions';
import { enrichUsersWithData } from '@/lib/user-service';
import type { Database, EndUser, License, Application } from '@/lib/supabase/types';

export async function GET(request: Request) {
  const auth = await getOwnerUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.trim().toLowerCase();
  const applicationId = searchParams.get('application_id')?.trim();
  const status = searchParams.get('status')?.trim().toLowerCase();
  const licenseStatus = searchParams.get('license_status')?.trim().toLowerCase();
  const subscription = searchParams.get('subscription')?.trim().toLowerCase();
  const expiryFilter = searchParams.get('expiry')?.trim().toLowerCase();
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

  const supabase = await createClient();

  // 1. Get applications owned by this owner
  const { data: apps, error: appErr } = await supabase
    .from('applications')
    .select('id, name, client_id')
    .eq('owner_id', auth.profile.id);

  if (appErr) {
    return NextResponse.json({ error: appErr.message }, { status: 500 });
  }

  const appList = (apps || []) as Application[];
  const appIds = appList.map((a) => a.id);
  if (appIds.length === 0) {
    return NextResponse.json({
      users: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
      applications: [],
      subscriptions: AVAILABLE_SUBSCRIPTIONS
    });
  }

  // Determine target apps
  let targetAppIds = appIds;
  if (applicationId && applicationId !== 'all') {
    if (!appIds.includes(applicationId)) {
      return NextResponse.json({ error: 'Application not found or unauthorized' }, { status: 403 });
    }
    targetAppIds = [applicationId];
  }

  // 2. Fetch users belonging to target applications
  let query = supabase
    .from('application_users')
    .select('id, application_id, username, email, password_hash, status, created_at, updated_at, last_login_at')
    .in('application_id', targetAppIds)
    .order('created_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status as 'active' | 'disabled' | 'suspended');
  }

  if (search) {
    query = query.or(`email.ilike.%${search}%,username.ilike.%${search}%`);
  }

  const { data: rawUsers, error: userErr } = await query;

  if (userErr) {
    console.error('[API Users GET] Database error fetching application users:', userErr);
    if (
      userErr.code === 'PGRST205' ||
      userErr.message?.includes('schema cache') ||
      userErr.message?.includes('does not exist')
    ) {
      return NextResponse.json(
        {
          error:
            'Table "application_users" does not exist in Supabase. Please execute the migration in supabase/migrations/20260925130000_create_application_users.sql in your Supabase SQL Editor.',
          code: 'TABLE_MISSING',
          migrationFile: 'supabase/migrations/20260925130000_create_application_users.sql'
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: 'Unable to load application users. Please try again.' },
      { status: 500 }
    );
  }

  // 3. Batch fetch licenses for the target applications
  const { data: rawLicenses } = await supabase
    .from('licenses')
    .select('id, application_id, license_key, subscription, status, allowed_devices, used_devices, device_hwids, note, expires_at, created_at, updated_at, revoked_at')
    .in('application_id', targetAppIds);

  // 4. Batch fetch application logs for user events and activity
  const { data: rawLogs } = await supabase
    .from('application_logs')
    .select('event, application_id, metadata, created_at')
    .in('application_id', targetAppIds)
    .order('created_at', { ascending: false })
    .limit(200);

  // 5. Enrich users with license details, device usage, and activity statistics
  const usersList = (rawUsers || []) as EndUser[];
  const licensesList = (rawLicenses || []) as License[];
  const logsList = (rawLogs || []) as { event: string; application_id: string | null; metadata: any; created_at: string }[];

  let enrichedUsers = enrichUsersWithData(usersList, appList, licensesList, logsList);

  // 6. Apply post-enrichment filters (License Status, Subscription, Expiry)
  if (licenseStatus && licenseStatus !== 'all') {
    enrichedUsers = enrichedUsers.filter((u) => {
      if (licenseStatus === 'no_license') {
        return !u.license;
      }
      return u.license && u.license.status === licenseStatus;
    });
  }

  if (subscription && subscription !== 'all') {
    enrichedUsers = enrichedUsers.filter(
      (u) => u.license && u.license.subscription.toLowerCase() === subscription
    );
  }

  if (expiryFilter && expiryFilter !== 'all') {
    enrichedUsers = enrichedUsers.filter((u) => {
      if (!u.license) return expiryFilter === 'no_expiry';
      switch (expiryFilter) {
        case 'active':
          return !u.license.is_expired && !u.license.is_expiring_soon && u.license.expires_at !== null;
        case 'expiring_soon':
          return u.license.is_expiring_soon;
        case 'expired':
          return u.license.is_expired;
        case 'no_expiry':
          return u.license.expires_at === null;
        default:
          return true;
      }
    });
  }

  // 7. Pagination
  const totalCount = enrichedUsers.length;
  const totalPages = Math.ceil(totalCount / limit) || 1;
  const startIndex = (page - 1) * limit;
  const paginatedUsers = enrichedUsers.slice(startIndex, startIndex + limit);

  return NextResponse.json({
    users: paginatedUsers,
    total: totalCount,
    page,
    limit,
    totalPages,
    applications: appList,
    subscriptions: AVAILABLE_SUBSCRIPTIONS
  });
}

export async function POST(request: Request) {
  const auth = await getOwnerUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const applicationId = body.application_id || body.applicationId;
    let {
      email,
      username,
      password,
      status = 'active',
      generate_token,
      subscription,
      expiry,
      hwid_locked,
      allowed_devices
    } = body;

    if (!applicationId) {
      return NextResponse.json(
        { error: 'Application selection is required' },
        { status: 400 }
      );
    }

    if (!username && !email) {
      return NextResponse.json(
        { error: 'Username or email address is required' },
        { status: 400 }
      );
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      const cleanUser = (username || 'user').toLowerCase().replace(/[^a-z0-9]/g, '');
      email = `${cleanUser || 'user'}@app.local`;
    }

    if (!password || typeof password !== 'string' || password.length < 1 || password.length > 100) {
      return NextResponse.json(
        { error: 'Password must be between 1 and 100 characters' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify application ownership
    const { data: app, error: appErr } = await supabase
      .from('applications')
      .select('id, name')
      .eq('id', applicationId)
      .eq('owner_id', auth.profile.id)
      .single();

    if (appErr || !app) {
      return NextResponse.json(
        { error: 'Application not found or unauthorized' },
        { status: 404 }
      );
    }

    // Check duplicate email
    const { data: existingUser, error: checkError } = await supabase
      .from('application_users')
      .select('id')
      .eq('application_id', applicationId)
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (
      checkError &&
      (checkError.code === 'PGRST205' ||
        checkError.message?.includes('schema cache') ||
        checkError.message?.includes('does not exist'))
    ) {
      return NextResponse.json(
        {
          error:
            'Table "application_users" does not exist in Supabase. Please execute the migration in supabase/migrations/20260925130000_create_application_users.sql in your Supabase SQL Editor.',
          code: 'TABLE_MISSING',
          migrationFile: 'supabase/migrations/20260925130000_create_application_users.sql'
        },
        { status: 503 }
      );
    }

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists in this application' },
        { status: 409 }
      );
    }

    const passwordHash = await hashUserPassword(password);

    const userPayload: Database['public']['Tables']['application_users']['Insert'] = {
      application_id: applicationId,
      email: email.trim().toLowerCase(),
      username: username ? String(username).trim() : null,
      password_hash: passwordHash,
      status: status === 'disabled' || status === 'suspended' ? status : 'active'
    };

    const { data: newUser, error: insertError } = await supabase
      .from('application_users')
      .insert(userPayload)
      .select('id, application_id, username, email, status, created_at, updated_at, last_login_at')
      .single();

    if (insertError || !newUser) {
      console.error('[API Users POST] Error creating application user:', insertError);
      return NextResponse.json(
        { error: insertError?.message || 'Failed to create user' },
        { status: 500 }
      );
    }

    // Auto-generate license if subscription or device settings were specified
    let generatedLicenseKey: string | null = null;
    let licenseId: string | null = null;
    try {
      const { data: existingLicRows } = await supabase.from('licenses').select('license_key');
      const existingKeySet = new Set((existingLicRows || []).map((l) => l.license_key));

      const [newKey] = generateUniqueLicenses({
        mask: 'JH10C-XXXX-XXXX',
        amount: 1,
        charSets: { uppercase: true, numbers: true },
        existingKeys: existingKeySet
      });

      const parsedDevices =
        allowed_devices === 'unlimited' ? 9999 : Math.max(1, parseInt(allowed_devices, 10) || 1);

      const expiresAtIso = expiry ? new Date(expiry).toISOString() : null;

      const { data: createdLic } = await supabase
        .from('licenses')
        .insert({
          application_id: applicationId,
          license_key: newKey,
          subscription: subscription || 'default',
          status: 'active',
          allowed_devices: parsedDevices,
          used_devices: 0,
          device_hwids: [],
          note: newUser.email,
          expires_at: expiresAtIso
        })
        .select()
        .single();

      if (createdLic) {
        generatedLicenseKey = createdLic.license_key;
        licenseId = createdLic.id;
      }
    } catch (licErr) {
      console.warn('[API Users POST] Standalone license auto-creation skipped:', licErr);
    }

    let token: string | null = null;
    if (generate_token) {
      const crypto = await import('crypto');
      token = `usr_tok_${crypto.randomBytes(24).toString('hex')}`;
    }

    await logApplicationEvent({
      applicationId: applicationId,
      event: 'user.created',
      metadata: {
        userId: newUser.id,
        email: newUser.email,
        username: newUser.username,
        status: newUser.status,
        subscription: subscription || 'default',
        expiry: expiry || null,
        hwid_locked: !!hwid_locked,
        allowed_devices: allowed_devices || 1,
        licenseId: licenseId || null,
        licenseKey: generatedLicenseKey ? `${generatedLicenseKey.slice(-4)}` : null,
        token_generated: !!token
      }
    });

    return NextResponse.json(
      {
        user: {
          ...newUser,
          application: { id: app.id, name: app.name }
        },
        token,
        licenseKey: generatedLicenseKey
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
