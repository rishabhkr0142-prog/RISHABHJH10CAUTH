import { NextResponse } from 'next/server';
import { getOwnerUser, logApplicationEvent } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';
import { hashUserPassword } from '@/lib/crypto';
import type { Database } from '@/lib/supabase/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const auth = await getOwnerUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: applicationId, userId } = await params;
  const supabase = await createClient();

  // Verify ownership of the application
  const { data: app, error: appErr } = await supabase
    .from('applications')
    .select('id')
    .eq('id', applicationId)
    .eq('owner_id', auth.profile.id)
    .single();

  if (appErr || !app) {
    return NextResponse.json(
      { error: 'Application not found or unauthorized' },
      { status: 404 }
    );
  }

  const { data: user, error } = await supabase
    .from('application_users')
    .select('id, application_id, username, email, status, created_at, updated_at, last_login_at')
    .eq('id', userId)
    .eq('application_id', applicationId)
    .single();

  if (error || !user) {
    if (error?.code === 'PGRST205' || error?.message?.includes('schema cache')) {
      return NextResponse.json(
        {
          error: 'Table "application_users" does not exist in Supabase.',
          code: 'TABLE_MISSING'
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const auth = await getOwnerUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: applicationId, userId } = await params;

  try {
    const body = await request.json();
    const { status, password, username, email } = body;

    const supabase = await createClient();

    // Verify ownership of the application
    const { data: app, error: appErr } = await supabase
      .from('applications')
      .select('id')
      .eq('id', applicationId)
      .eq('owner_id', auth.profile.id)
      .single();

    if (appErr || !app) {
      return NextResponse.json(
        { error: 'Application not found or unauthorized' },
        { status: 404 }
      );
    }

    // Verify user exists and belongs to application
    const { data: existingUser, error: findError } = await supabase
      .from('application_users')
      .select('id, email, username, status')
      .eq('id', userId)
      .eq('application_id', applicationId)
      .single();

    if (findError || !existingUser) {
      if (findError?.code === 'PGRST205' || findError?.message?.includes('schema cache')) {
        return NextResponse.json(
          {
            error: 'Table "application_users" does not exist in Supabase.',
            code: 'TABLE_MISSING'
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

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
    if (password && typeof password === 'string') {
      if (password.length < 6) {
        return NextResponse.json(
          { error: 'Password must be at least 6 characters long' },
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
      .eq('application_id', applicationId)
      .select('id, application_id, username, email, status, created_at, updated_at, last_login_at')
      .single();

    if (updateError) {
      console.error('[API App User PATCH] Error updating user:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await logApplicationEvent({
      applicationId,
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
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const auth = await getOwnerUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: applicationId, userId } = await params;
  const supabase = await createClient();

  // Verify ownership of the application
  const { data: app, error: appErr } = await supabase
    .from('applications')
    .select('id')
    .eq('id', applicationId)
    .eq('owner_id', auth.profile.id)
    .single();

  if (appErr || !app) {
    return NextResponse.json(
      { error: 'Application not found or unauthorized' },
      { status: 404 }
    );
  }

  // Verify user exists
  const { data: user, error: findError } = await supabase
    .from('application_users')
    .select('id, email')
    .eq('id', userId)
    .eq('application_id', applicationId)
    .single();

  if (findError || !user) {
    if (findError?.code === 'PGRST205' || findError?.message?.includes('schema cache')) {
      return NextResponse.json(
        {
          error: 'Table "application_users" does not exist in Supabase.',
          code: 'TABLE_MISSING'
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { error: deleteError } = await supabase
    .from('application_users')
    .delete()
    .eq('id', userId)
    .eq('application_id', applicationId);

  if (deleteError) {
    console.error('[API App User DELETE] Error deleting user:', deleteError);
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  await logApplicationEvent({
    applicationId,
    event: 'user.deleted',
    metadata: {
      userId,
      email: user.email
    }
  });

  return NextResponse.json({ success: true });
}
