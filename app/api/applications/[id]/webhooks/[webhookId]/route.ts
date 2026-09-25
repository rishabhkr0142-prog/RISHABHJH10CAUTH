import { NextResponse } from 'next/server';
import { getOwnerUser, logApplicationEvent } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';

function isValidUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; webhookId: string }> }
) {
  const auth = await getOwnerUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: applicationId, webhookId } = await params;
  const body = await request.json();
  const supabase = await createClient();

  // Verify ownership
  const { data: app, error: appErr } = await supabase
    .from('applications')
    .select('id')
    .eq('id', applicationId)
    .eq('owner_id', auth.profile.id)
    .single();

  if (appErr || !app) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  const updateData: Database['public']['Tables']['webhooks']['Update'] = {
    updated_at: new Date().toISOString()
  };

  if (body.url !== undefined) {
    if (!isValidUrl(body.url)) {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }
    updateData.url = body.url;
  }

  if (body.enabled !== undefined) {
    updateData.enabled = Boolean(body.enabled);
  }

  const { data: updated, error: updateErr } = await supabase
    .from('webhooks')
    .update(updateData)
    .eq('id', webhookId)
    .eq('application_id', applicationId)
    .select('id, application_id, url, enabled, created_at, updated_at')
    .single();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  await logApplicationEvent({
    applicationId,
    event: 'webhook_updated',
    metadata: { webhook_id: webhookId, ...updateData }
  });

  return NextResponse.json({ webhook: updated });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; webhookId: string }> }
) {
  const auth = await getOwnerUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: applicationId, webhookId } = await params;
  const supabase = await createClient();

  // Verify ownership
  const { data: app, error: appErr } = await supabase
    .from('applications')
    .select('id')
    .eq('id', applicationId)
    .eq('owner_id', auth.profile.id)
    .single();

  if (appErr || !app) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  const { data: deleted, error: deleteErr } = await supabase
    .from('webhooks')
    .delete()
    .eq('id', webhookId)
    .eq('application_id', applicationId)
    .select()
    .single();

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  await logApplicationEvent({
    applicationId,
    event: 'webhook_deleted',
    metadata: { webhook_id: webhookId, url: deleted?.url }
  });

  return NextResponse.json({ success: true, message: 'Webhook deleted' });
}
