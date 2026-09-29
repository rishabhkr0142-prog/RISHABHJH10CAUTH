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

  const { id: userId } = await params;
  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  const supabase = await createClient();

  // Find user and join with applications to verify owner authorization
  const { data: user, error: userError } = await supabase
    .from('application_users')
    .select('id, application_id, username, email, status, created_at, updated_at, last_login_at')
    .eq('id', userId)
    .maybeSingle();

  if (userError || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Verify ownership of the application to prevent IDOR
  const { data: app, error: appError } = await supabase
    .from('applications')
    .select('id, name')
    .eq('id', user.application_id)
    .eq('owner_id', auth.profile.id)
    .maybeSingle();

  if (appError || !app) {
    return NextResponse.json(
      { error: 'Application not found or unauthorized' },
      { status: 403 }
    );
  }

  return NextResponse.json({ user, application: app });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getOwnerUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: userId } = await params;
  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    // Find user first
    const { data: existingUser, error: findError } = await supabase
      .from('application_users')
      .select('id, application_id, email, username, status')
      .eq('id', userId)
      .maybeSingle();

    if (findError || !existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify application ownership
    const { data: app, error: appError } = await supabase
      .from('applications')
      .select('id')
      .eq('id', existingUser.application_id)
      .eq('owner_id', auth.profile.id)
      .maybeSingle();

    if (appError || !app) {
      return NextResponse.json(
        { error: 'Application not found or unauthorized' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status, password, username, email } = body;

    const updatePayload: Database['public']['Tables']['application_users']['Update'] = {
      updated_at: new Date().toISOString()
    };

    if (status && ['active', 'disabled', 'suspended'].includes(status)) {
      updatePayload.status = status as 'active' | 'disabled' | 'suspended';
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
        return NextResponse.json(
          { error: 'Password must be between 1 and 100 characters' },
          { status: 400 }
        );
      }
      updatePayload.password_hash = await hashUserPassword(password);
      passwordReset = true;
    }

    const { data: updatedUser, error: updateError } = await supabase
      .from('application_users')
      .update(updatePayload)
      .eq('id', userId)
      .select('id, application_id, username, email, status, created_at, updated_at, last_login_at')
      .single();

    if (updateError) {
      console.error('[API Users [id] PATCH] Error updating user:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await logApplicationEvent({
      applicationId: existingUser.application_id,
      event: passwordReset ? 'user.password_reset' : 'user.updated',
      metadata: {
        userId,
        statusChanged: status ? status !== existingUser.status : false,
        newStatus: updatePayload.status,
        passwordReset
      }
    });

    return NextResponse.json({ user: updatedUser });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getOwnerUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: userId } = await params;
  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  const supabase = await createClient();

  // Find user
  const { data: user, error: findError } = await supabase
    .from('application_users')
    .select('id, application_id, email')
    .eq('id', userId)
    .maybeSingle();

  if (findError || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Verify application ownership
  const { data: app, error: appError } = await supabase
    .from('applications')
    .select('id')
    .eq('id', user.application_id)
    .eq('owner_id', auth.profile.id)
    .maybeSingle();

  if (appError || !app) {
    return NextResponse.json(
      { error: 'Application not found or unauthorized' },
      { status: 403 }
    );
  }

  const { error: deleteError } = await supabase
    .from('application_users')
    .delete()
    .eq('id', userId);

  if (deleteError) {
    console.error('[API Users [id] DELETE] Error deleting user:', deleteError);
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  await logApplicationEvent({
    applicationId: user.application_id,
    event: 'user.deleted',
    metadata: {
      userId,
      email: user.email
    }
  });

  return NextResponse.json({ success: true });
}
