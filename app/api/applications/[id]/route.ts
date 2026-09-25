import { NextResponse } from 'next/server';
import { getOwnerUser, logApplicationEvent } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateClientSecret, hashSecret } from '@/lib/crypto';
import type { Database } from '@/lib/supabase/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getOwnerUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = await createClient();

  const { data: app, error } = await supabase
    .from('applications')
    .select(`
      *,
      api_keys (*),
      redirect_urls (*),
      webhooks (*),
      application_logs (*)
    `)
    .eq('id', id)
    .eq('owner_id', auth.profile.id)
    .single();

  if (error || !app) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  const appData = app as any;

  // If client_secret was not stored previously, generate and save it so owner always sees complete secret
  if (!appData.client_secret) {
    const rawSecret = generateClientSecret();
    const secretHash = hashSecret(rawSecret);
    const admin = createAdminClient();
    const { error: updateErr } = await admin
      .from('applications')
      .update({
        client_secret: rawSecret,
        client_secret_hash: secretHash,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
    if (!updateErr) {
      appData.client_secret = rawSecret;
    }
  }

  return NextResponse.json({ application: appData });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getOwnerUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const supabase = await createClient();

  // Check existence and ownership
  const { data: existingApp, error: fetchErr } = await supabase
    .from('applications')
    .select('*')
    .eq('id', id)
    .eq('owner_id', auth.profile.id)
    .single();

  if (fetchErr || !existingApp) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  // Handle secret regeneration
  if (body.regenerate_secret === true) {
    const rawClientSecret = generateClientSecret();
    const secretHash = hashSecret(rawClientSecret);

    const { data: updatedApp, error: updateErr } = await supabase
      .from('applications')
      .update({
        client_secret: rawClientSecret,
        client_secret_hash: secretHash,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('owner_id', auth.profile.id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    await logApplicationEvent({
      applicationId: id,
      event: 'client_secret_regenerated',
      metadata: { client_id: existingApp.client_id }
    });

    return NextResponse.json({
      application: updatedApp,
      raw_client_secret: rawClientSecret
    });
  }

  // Handle general update (name, description, status)
  const updatePayload: Database['public']['Tables']['applications']['Update'] = {
    updated_at: new Date().toISOString()
  };

  if (typeof body.name === 'string' && body.name.trim().length > 0) {
    updatePayload.name = body.name.trim();
  }

  if (body.description !== undefined) {
    updatePayload.description = body.description ? String(body.description).trim() : null;
  }

  if (['active', 'inactive', 'revoked'].includes(body.status)) {
    updatePayload.status = body.status as 'active' | 'inactive' | 'revoked';
  }

  const { data: updatedApp, error: updateErr } = await supabase
    .from('applications')
    .update(updatePayload)
    .eq('id', id)
    .eq('owner_id', auth.profile.id)
    .select()
    .single();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  await logApplicationEvent({
    applicationId: id,
    event: 'application_updated',
    metadata: updatePayload
  });

  return NextResponse.json({ application: updatedApp });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getOwnerUser();
    if (!auth || auth.profile.role.toUpperCase() !== 'OWNER') {
      return NextResponse.json(
        { error: 'Unauthorized: Only the platform owner can delete applications' },
        { status: 401 }
      );
    }

    const { id } = await params;
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Valid application ID is required' }, { status: 400 });
    }

    const admin = createAdminClient();

    // 1. Fetch application and verify owner identity server-side
    const { data: existingApp, error: fetchErr } = await admin
      .from('applications')
      .select('id, name, owner_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) {
      console.error('Error fetching application for deletion:', fetchErr);
      return NextResponse.json({ error: 'Database failure verifying application' }, { status: 500 });
    }

    if (!existingApp) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    if (existingApp.owner_id !== auth.profile.id) {
      return NextResponse.json(
        { error: 'Forbidden: Application does not belong to current owner' },
        { status: 403 }
      );
    }

    // 2. Explicitly delete dependent records in safe dependency order to prevent FK restriction errors & orphaned data
    await admin.from('application_logs').delete().eq('application_id', id);
    await admin.from('webhooks').delete().eq('application_id', id);
    await admin.from('redirect_urls').delete().eq('application_id', id);
    await admin.from('api_keys').delete().eq('application_id', id);
    await admin.from('application_users').delete().eq('application_id', id);

    // 3. Delete the application
    const { error: deleteErr } = await admin
      .from('applications')
      .delete()
      .eq('id', id)
      .eq('owner_id', auth.profile.id);

    if (deleteErr) {
      console.error('Error deleting application:', deleteErr);
      return NextResponse.json({ error: 'Failed to delete application. Please try again.' }, { status: 500 });
    }

    // 4. Log the audit event
    await logApplicationEvent({
      applicationId: null,
      event: 'application_deleted',
      metadata: { application_id: id, name: existingApp.name }
    });

    return NextResponse.json({
      success: true,
      message: `Application "${existingApp.name}" was successfully deleted.`
    });
  } catch (err: any) {
    console.error('Unexpected error during application deletion:', err);
    return NextResponse.json({ error: 'Internal server error while deleting application' }, { status: 500 });
  }
}
