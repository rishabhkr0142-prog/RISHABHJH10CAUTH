import { NextResponse } from 'next/server';
import { getOwnerUser, logApplicationEvent } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

function isValidRedirectUrl(urlString: string): boolean {
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

  const { data: urls, error } = await supabase
    .from('redirect_urls')
    .select('*')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ redirect_urls: urls });
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

  if (!url || !isValidRedirectUrl(url)) {
    return NextResponse.json(
      { error: 'Invalid URL format. Must start with http:// or https://' },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Verify ownership of application
  const { data: app, error: appErr } = await supabase
    .from('applications')
    .select('id')
    .eq('id', applicationId)
    .eq('owner_id', auth.profile.id)
    .single();

  if (appErr || !app) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  const { data: record, error: insertErr } = await supabase
    .from('redirect_urls')
    .insert({
      application_id: applicationId,
      url
    })
    .select()
    .single();

  if (insertErr || !record) {
    return NextResponse.json(
      { error: insertErr?.message || 'Failed to add redirect URL' },
      { status: 500 }
    );
  }

  await logApplicationEvent({
    applicationId,
    event: 'redirect_url_added',
    metadata: { url }
  });

  return NextResponse.json({ redirect_url: record });
}
