import { NextResponse } from 'next/server';
import { getOwnerUser, logApplicationEvent } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';
import { generateApiKey, hashSecret } from '@/lib/crypto';

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

  // Verify ownership of the application
  const { data: app, error: appErr } = await supabase
    .from('applications')
    .select('id')
    .eq('id', applicationId)
    .eq('owner_id', auth.profile.id)
    .single();

  if (appErr || !app) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  const { data: keys, error } = await supabase
    .from('api_keys')
    .select('id, application_id, name, key_prefix, last_used_at, created_at, revoked_at')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ keys });
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
  const name = body.name ? String(body.name).trim() : 'Default API Key';

  const supabase = await createClient();

  // Verify ownership
  const { data: app, error: appErr } = await supabase
    .from('applications')
    .select('id, name')
    .eq('id', applicationId)
    .eq('owner_id', auth.profile.id)
    .single();

  if (appErr || !app) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  const { fullKey, prefix } = generateApiKey();
  const keyHash = hashSecret(fullKey);

  const { data: keyRecord, error: insertErr } = await supabase
    .from('api_keys')
    .insert({
      application_id: applicationId,
      name,
      key_prefix: prefix,
      key_hash: keyHash
    })
    .select('id, application_id, name, key_prefix, created_at')
    .single();

  if (insertErr || !keyRecord) {
    return NextResponse.json(
      { error: insertErr?.message || 'Failed to create API key' },
      { status: 500 }
    );
  }

  await logApplicationEvent({
    applicationId,
    event: 'api_key_created',
    metadata: { key_id: keyRecord.id, name, prefix }
  });

  return NextResponse.json({
    key: keyRecord,
    // The raw key is returned ONLY once upon creation!
    raw_key: fullKey
  });
}
