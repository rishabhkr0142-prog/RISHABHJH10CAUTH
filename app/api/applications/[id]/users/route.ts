import { NextResponse } from 'next/server';
import { getOwnerUser, logApplicationEvent } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';
import { hashUserPassword } from '@/lib/crypto';
import type { Database } from '@/lib/supabase/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getOwnerUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: applicationId } = await params;
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.trim().toLowerCase();
  const status = searchParams.get('status')?.trim().toLowerCase();

  const supabase = await createClient();

  // Verify ownership of the application
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

  let query = supabase
    .from('application_users')
    .select('id, application_id, username, email, status, created_at, updated_at, last_login_at')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status as 'active' | 'disabled' | 'suspended');
  }

  if (search) {
    query = query.or(`email.ilike.%${search}%,username.ilike.%${search}%`);
  }

  const { data: users, error } = await query;

  if (error) {
    console.error('[API App Users GET] Database error fetching application users:', error);
    if (
      error.code === 'PGRST205' ||
      error.message?.includes('schema cache') ||
      error.message?.includes('does not exist')
    ) {
      return NextResponse.json(
        {
          error: 'Table "application_users" does not exist in Supabase. Please execute the migration in supabase/migrations/20260925130000_create_application_users.sql in your Supabase SQL Editor.',
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

  return NextResponse.json({ users: users || [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getOwnerUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: applicationId } = await params;

  try {
    const body = await request.json();
    let { email, username, password, status = 'active', generate_token } = body;

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

    // Check if user already exists for this application
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
          error: 'Table "application_users" does not exist in Supabase. Please execute the migration in supabase/migrations/20260925130000_create_application_users.sql in your Supabase SQL Editor.',
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

    // Hash password securely with bcrypt
    const passwordHash = await hashUserPassword(password);

    const userPayload: Database['public']['Tables']['application_users']['Insert'] = {
      application_id: applicationId,
      email: email.trim().toLowerCase(),
      username: username ? String(username).trim() : null,
      password_hash: passwordHash,
      status: status === 'disabled' || status === 'suspended' ? status : 'active',
    };

    const { data: newUser, error: insertError } = await supabase
      .from('application_users')
      .insert(userPayload)
      .select('id, application_id, username, email, status, created_at, updated_at, last_login_at')
      .single();

    if (insertError) {
      console.error('[API App Users POST] Error creating application user:', insertError);
      if (
        insertError.code === 'PGRST205' ||
        insertError.message?.includes('schema cache') ||
        insertError.message?.includes('does not exist')
      ) {
        return NextResponse.json(
          {
            error: 'Table "application_users" does not exist in Supabase. Please execute the migration in supabase/migrations/20260925130000_create_application_users.sql in your Supabase SQL Editor.',
            code: 'TABLE_MISSING',
            migrationFile: 'supabase/migrations/20260925130000_create_application_users.sql'
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: insertError.message || 'Failed to create user' }, { status: 500 });
    }

    let token: string | null = null;
    if (generate_token) {
      const crypto = await import('crypto');
      token = `usr_tok_${crypto.randomBytes(24).toString('hex')}`;
    }

    await logApplicationEvent({
      applicationId,
      event: 'user.created',
      metadata: {
        userId: newUser.id,
        email: newUser.email,
        username: newUser.username,
        status: newUser.status,
        token_generated: !!token
      }
    });

    return NextResponse.json({ user: newUser, token }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
