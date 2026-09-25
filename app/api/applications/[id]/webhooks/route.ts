import { NextResponse } from 'next/server';
import { getOwnerUser, logApplicationEvent } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';
import { generateWebhookSecret, hashSecret } from '@/lib/crypto';

function isValidUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getOwnerUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: applicationId } = await params;
  const supabase = await createClient();

  const { data: webhooks, error } = await supabase
    .from('webhooks')
    .select('id, application_id, url, enabled, created_at, updated_at')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ webhooks });
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
  const body = await request.json();
  const url = body.url ? String(body.url).trim() : '';
  const enabled = body.enabled !== false;

  if (!url || !isValidUrl(url)) {
    return NextResponse.json(
      { error: 'Invalid webhook endpoint URL' },
      { status: 400 }
    );
  }

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

  const rawSecret = generateWebhookSecret();
  const secretHash = hashSecret(rawSecret);

  const { data: webhook, error: insertErr } = await supabase
    .from('webhooks')
    .insert({
      application_id: applicationId,
      url,
      secret_hash: secretHash,
      enabled
    })
    .select('id, application_id, url, enabled, created_at, updated_at')
    .single();

  if (insertErr || !webhook) {
    return NextResponse.json(
      { error: insertErr?.message || 'Failed to create webhook' },
      { status: 500 }
    );
  }

  await logApplicationEvent({
    applicationId,
    event: 'webhook_created',
    metadata: { webhook_id: webhook.id, url, enabled }
  });

  return NextResponse.json({
    webhook,
    raw_secret: rawSecret
  });
}
