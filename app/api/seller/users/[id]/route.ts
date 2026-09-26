import { NextResponse } from 'next/server';
import { authenticateSellerKey } from '@/lib/seller-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashUserPassword } from '@/lib/crypto';
import { logApplicationEvent } from '@/lib/supabase/auth';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateSellerKey(request);
  if (!auth.success) {
    return NextResponse.json(
      { success: false, error: auth.error, ...(auth.code ? { code: auth.code } : {}) },
      { status: auth.status }
    );
  }

  const { sellerKey, application } = auth.context;
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ success: false, error: 'User identifier is required' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: user, error } = await admin
    .from('application_users')
    .select('id, application_id, username, email, status, created_at, updated_at, last_login_at')
    .eq('application_id', application.id)
    .or(`id.eq.${id},username.eq.${id},email.eq.${id}`)
    .maybeSingle();

  if (error || !user) {
    return NextResponse.json({ success: false, error: 'User not found in this application' }, { status: 404 });
  }

  return NextResponse.json({ success: true, user });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateSellerKey(request);
  if (!auth.success) {
    return NextResponse.json(
      { success: false, error: auth.error, ...(auth.code ? { code: auth.code } : {}) },
      { status: auth.status }
    );
  }

  const { sellerKey, application } = auth.context;
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ success: false, error: 'User identifier is required' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const { status, password, username, email } = body;

  const admin = createAdminClient();

  // Find user strictly within application
  const { data: existingUser } = await admin
    .from('application_users')
    .select('id, status, email, username')
    .eq('application_id', application.id)
    .or(`id.eq.${id},username.eq.${id},email.eq.${id}`)
    .maybeSingle();

  if (!existingUser) {
    return NextResponse.json({ success: false, error: 'User not found in this application' }, { status: 404 });
  }

  const updatePayload: any = {
    updated_at: new Date().toISOString()
  };

  if (status && ['active', 'disabled', 'suspended'].includes(status)) {
    updatePayload.status = status;
  }

  if (username !== undefined) {
    updatePayload.username = username ? String(username).trim() : null;
  }

  if (email && typeof email === 'string' && email.includes('@')) {
    updatePayload.email = email.trim().toLowerCase();
  }

  let passwordReset = false;
  if (password !== undefined) {
    if (!password || typeof password !== 'string' || password.length < 1 || password.length > 100) {
      return NextResponse.json({ success: false, error: 'Password must be between 1 and 100 characters' }, { status: 400 });
    }
    updatePayload.password_hash = await hashUserPassword(password);
    passwordReset = true;
  }

  const { data: updatedUser, error: updateErr } = await admin
    .from('application_users')
    .update(updatePayload)
    .eq('id', existingUser.id)
    .eq('application_id', application.id)
    .select('id, application_id, username, email, status, created_at, updated_at, last_login_at')
    .single();

  if (updateErr) {
    return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
  }

  await logApplicationEvent({
    applicationId: application.id,
    event: passwordReset ? 'seller.user.password_reset' : 'seller.user.updated',
    metadata: {
      sellerKeyId: sellerKey.id,
      userId: existingUser.id,
      status: updatePayload.status,
      passwordReset
    }
  });

  return NextResponse.json({
    success: true,
    message: passwordReset ? 'Password reset successfully' : 'User updated successfully',
    user: updatedUser
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateSellerKey(request);
  if (!auth.success) {
    return NextResponse.json(
      { success: false, error: auth.error, ...(auth.code ? { code: auth.code } : {}) },
      { status: auth.status }
    );
  }

  const { sellerKey, application } = auth.context;
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ success: false, error: 'User identifier is required' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: existingUser } = await admin
    .from('application_users')
    .select('id, email, username')
    .eq('application_id', application.id)
    .or(`id.eq.${id},username.eq.${id},email.eq.${id}`)
    .maybeSingle();

  if (!existingUser) {
    return NextResponse.json({ success: false, error: 'User not found in this application' }, { status: 404 });
  }

  const { error: deleteErr } = await admin
    .from('application_users')
    .delete()
    .eq('id', existingUser.id)
    .eq('application_id', application.id);

  if (deleteErr) {
    return NextResponse.json({ success: false, error: deleteErr.message }, { status: 500 });
  }

  await logApplicationEvent({
    applicationId: application.id,
    event: 'seller.user.deleted',
    metadata: {
      sellerKeyId: sellerKey.id,
      userId: existingUser.id,
      username: existingUser.username,
      email: existingUser.email
    }
  });

  return NextResponse.json({ success: true, message: 'User deleted successfully' });
}
