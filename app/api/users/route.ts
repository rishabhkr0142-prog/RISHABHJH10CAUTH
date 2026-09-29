import { NextResponse } from 'next/server';
import { getOwnerUser, logApplicationEvent } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashUserPassword } from '@/lib/crypto';
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

  const admin = createAdminClient();

  // 1. Get applications owned by this owner
  const { data: apps, error: appErr } = await admin
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
      subscriptions: AVAILABLE_SUBSCRIPTIONS,
      stats: {
        totalUsers: 0,
        activeAccounts: 0,
        activeLicenses: 0,
        expiringSoon: 0,
        devicesInUse: 0
      }
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
  let query = admin
    .from('application_users')
    .select('id, application_id, username, email, password_hash, status, created_at, updated_at, last_login_at')
    .in('application_id', targetAppIds)
    .order('created_at', { ascending: false });

  if (status && status !== 'all') {
    let dbStatus = status;
    if (dbStatus === 'banned') dbStatus = 'suspended';
    if (dbStatus === 'paused') dbStatus = 'disabled';
    query = query.eq('status', dbStatus as 'active' | 'disabled' | 'suspended');
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
  const { data: rawLicenses } = await admin
    .from('licenses')
    .select('id, application_id, license_key, subscription, status, allowed_devices, used_devices, device_hwids, note, expires_at, created_at, updated_at, revoked_at')
    .in('application_id', targetAppIds);

  // 4. Batch fetch application logs for user events and activity
  const { data: rawLogs } = await admin
    .from('application_logs')
    .select('event, application_id, metadata, created_at')
    .in('application_id', targetAppIds)
    .in('event', [
      'user.login_success',
      'user_authentication',
      'license.validated',
      'auth.validate',
      'user.created',
      'seller.user.created'
    ])
    .order('created_at', { ascending: false })
    .limit(2000);

  // 5. Compute real database metrics for Summary Cards from actual database records
  const now = new Date();
  const allTargetUsers = (rawUsers || []) as EndUser[];
  const allTargetLicenses = (rawLicenses || []) as License[];

  const totalUsersCount = allTargetUsers.length;
  const activeAccountsCount = allTargetUsers.filter((u) => u.status === 'active').length;

  // Active licenses: Count licenses from the License table where status is active/used and not expired
  const activeLicensesInDb = allTargetLicenses.filter((lic) => {
    if (lic.status === 'revoked') return false;
    if (lic.expires_at && new Date(lic.expires_at) < now) return false;
    return lic.status === 'active' || lic.status === 'used';
  });
  const activeLicensesCount = activeLicensesInDb.length;

  // Expiring soon: <= 7 days, future expiry date, not revoked
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const expiringSoonLicenses = allTargetLicenses.filter((lic) => {
    if (lic.status === 'revoked') return false;
    if (!lic.expires_at) return false;
    const expDate = new Date(lic.expires_at);
    return expDate > now && expDate <= sevenDaysFromNow;
  });
  const expiringSoonCount = expiringSoonLicenses.length;

  // Devices in use: actual device usage from licenses
  const devicesInUseCount = activeLicensesInDb.reduce((acc, lic) => {
    const used = lic.used_devices ?? (lic.device_hwids?.length || 0);
    return acc + used;
  }, 0);

  // 6. Enrich users with license details, device usage, and activity statistics
  const usersList = allTargetUsers;
  const licensesList = allTargetLicenses;
  const logsList = (rawLogs || []) as { event: string; application_id: string | null; metadata: any; created_at: string }[];

  let enrichedUsers = enrichUsersWithData(usersList, appList, licensesList, logsList);

  // 7. Apply search filter across email, username, and license key
  if (search) {
    enrichedUsers = enrichedUsers.filter((u) => {
      const emailMatches = u.email?.toLowerCase().includes(search);
      const usernameMatches = u.username?.toLowerCase().includes(search);
      const licenseMatches =
        u.license &&
        (u.license.license_key_masked?.toLowerCase().includes(search) ||
          (u.license.license_key && u.license.license_key.toLowerCase().includes(search)));
      return Boolean(emailMatches || usernameMatches || licenseMatches);
    });
  }

  // 8. Apply post-enrichment filters (License Status, Subscription, Expiry)
  if (licenseStatus && licenseStatus !== 'all') {
    enrichedUsers = enrichedUsers.filter((u) => {
      if (licenseStatus === 'has_license') {
        return !!u.license;
      }
      if (licenseStatus === 'no_license') {
        return !u.license;
      }
      if (licenseStatus === 'active') {
        return u.license && (u.license.status === 'active' || u.license.status === 'used') && !u.license.is_expired;
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

  // 9. Pagination
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
    subscriptions: AVAILABLE_SUBSCRIPTIONS,
    stats: {
      totalUsers: totalUsersCount,
      activeAccounts: activeAccountsCount,
      activeLicenses: activeLicensesCount,
      expiringSoon: expiringSoonCount,
      devicesInUse: devicesInUseCount
    }
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
      generate_token
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
        token_generated: !!token
      }
    });

    return NextResponse.json(
      {
        user: {
          ...newUser,
          application: { id: app.id, name: app.name }
        },
        token
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

export async function DELETE(request: Request) {
  const auth = await getOwnerUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const userIds = Array.isArray(body.userIds) ? body.userIds : [];

    if (userIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one user ID must be selected for deletion' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // 1. Fetch applications owned by this owner
    const { data: ownerApps, error: appErr } = await admin
      .from('applications')
      .select('id')
      .eq('owner_id', auth.profile.id);

    if (appErr) {
      return NextResponse.json({ error: appErr.message }, { status: 500 });
    }

    const ownerAppIds = new Set((ownerApps || []).map((a) => a.id));

    // 2. Query target users to verify existence and ownership
    const { data: targetUsers, error: userErr } = await admin
      .from('application_users')
      .select('id, application_id, email, username')
      .in('id', userIds);

    if (userErr) {
      return NextResponse.json({ error: userErr.message }, { status: 500 });
    }

    if (!targetUsers || targetUsers.length === 0) {
      return NextResponse.json({ error: 'No matching users found' }, { status: 404 });
    }

    // 3. Security check: EVERY user must belong to an application owned by this owner
    const unauthorizedUser = targetUsers.find((u) => !ownerAppIds.has(u.application_id));
    if (unauthorizedUser || targetUsers.length !== userIds.length) {
      return NextResponse.json(
        { error: 'Forbidden: One or more selected users do not belong to an application you own' },
        { status: 403 }
      );
    }

    // 4. Safely delete the users from application_users
    // Note: Do NOT cascade delete unrelated licenses, applications, API keys, etc.
    const { error: deleteErr } = await admin
      .from('application_users')
      .delete()
      .in('id', userIds);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    // 5. Log audit trail
    for (const u of targetUsers) {
      await logApplicationEvent({
        applicationId: u.application_id,
        event: 'user.deleted',
        metadata: {
          userId: u.id,
          email: u.email,
          username: u.username,
          bulk: true,
          batchSize: userIds.length
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${targetUsers.length} user${targetUsers.length > 1 ? 's' : ''}`,
      deletedCount: targetUsers.length
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
