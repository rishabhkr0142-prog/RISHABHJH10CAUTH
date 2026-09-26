import { NextResponse } from 'next/server';
import { authenticateSellerKey } from '@/lib/seller-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashUserPassword } from '@/lib/crypto';
import { logApplicationEvent } from '@/lib/supabase/auth';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(request: Request) {
  const auth = await authenticateSellerKey(request);
  if (!auth.success) {
    return NextResponse.json(
      { success: false, error: auth.error, ...(auth.code ? { code: auth.code } : {}) },
      { status: auth.status }
    );
  }

  const { sellerKey, application } = auth.context;
  const rateLimit = checkRateLimit(`seller_${sellerKey.id}`, { limit: 60, windowMs: 60 * 1000 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded. Please wait a moment before trying again.' },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status')?.trim().toLowerCase();
  const search = searchParams.get('search')?.trim();
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;

  const admin = createAdminClient();

  try {
    let query = admin
      .from('application_users')
      .select('id, application_id, username, email, status, created_at, updated_at, last_login_at', { count: 'exact' })
      .eq('application_id', application.id)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status as any);
    }

    if (search) {
      query = query.or(`email.ilike.%${search}%,username.ilike.%${search}%`);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: users, count, error } = await query;
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      users: users || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await authenticateSellerKey(request);
  if (!auth.success) {
    return NextResponse.json(
      { success: false, error: auth.error, ...(auth.code ? { code: auth.code } : {}) },
      { status: auth.status }
    );
  }

  const { sellerKey, application } = auth.context;
  const rateLimit = checkRateLimit(`seller_${sellerKey.id}`, { limit: 60, windowMs: 60 * 1000 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded. Please wait a moment before trying again.' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    let { username, email, password, status = 'active' } = body;

    if (!username && !email) {
      return NextResponse.json({ success: false, error: 'Username or email address is required' }, { status: 400 });
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      const cleanUser = (username || 'user').toLowerCase().replace(/[^a-z0-9]/g, '');
      email = `${cleanUser || 'user'}@app.local`;
    }

    if (!password || typeof password !== 'string' || password.length < 1 || password.length > 100) {
      return NextResponse.json({ success: false, error: 'Password must be between 1 and 100 characters' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Check duplicate
    const { data: existingUser } = await admin
      .from('application_users')
      .select('id')
      .eq('application_id', application.id)
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({ success: false, error: 'A user with this email/username already exists in this application' }, { status: 409 });
    }

    const passwordHash = await hashUserPassword(password);
    const { data: newUser, error: insertError } = await admin
      .from('application_users')
      .insert({
        application_id: application.id,
        email: email.trim().toLowerCase(),
        username: username ? String(username).trim() : null,
        password_hash: passwordHash,
        status: status === 'disabled' || status === 'suspended' ? status : 'active'
      })
      .select('id, application_id, username, email, status, created_at, updated_at, last_login_at')
      .single();

    if (insertError) {
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
    }

    await logApplicationEvent({
      applicationId: application.id,
      event: 'seller.user.created',
      metadata: {
        sellerKeyId: sellerKey.id,
        userId: newUser.id,
        username: newUser.username,
        email: newUser.email
      }
    });

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      user: newUser
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
