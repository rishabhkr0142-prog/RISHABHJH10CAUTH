import { NextResponse } from 'next/server';
import { getOwnerUser, logApplicationEvent } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';
import { generateClientId, generateClientSecret, hashSecret } from '@/lib/crypto';

export async function GET() {
  const auth = await getOwnerUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: applications, error } = await supabase
    .from('applications')
    .select(`
      *,
      api_keys:api_keys(count),
      redirect_urls:redirect_urls(count),
      webhooks:webhooks(count)
    `)
    .eq('owner_id', auth.profile.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ applications });
}

export async function POST(request: Request) {
  const auth = await getOwnerUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Application name is required' },
        { status: 400 }
      );
    }

    const clientId = generateClientId();
    const rawClientSecret = generateClientSecret();
    const secretHash = hashSecret(rawClientSecret);

    const supabase = await createClient();
    const { data: app, error } = await supabase
      .from('applications')
      .insert({
        owner_id: auth.profile.id,
        name: name.trim(),
        description: description ? String(description).trim() : null,
        client_id: clientId,
        client_secret: rawClientSecret,
        client_secret_hash: secretHash,
        status: 'active'
      })
      .select()
      .single();

    if (error || !app) {
      const isSchemaCacheError =
        error?.message?.includes('client_secret') &&
        (error?.message?.includes('schema cache') || error?.message?.includes('column'));

      const errorMessage = isSchemaCacheError
        ? "Database setup required: The 'client_secret' column was not found in Supabase. Please execute the SQL migration in supabase/migrations/20260925120000_add_client_secret.sql (or supabase/schema.sql) in your Supabase SQL Editor and try again."
        : (error?.message || 'Failed to create application');

      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }

    await logApplicationEvent({
      applicationId: app.id,
      event: 'application_created',
      metadata: { name: app.name, client_id: app.client_id }
    });

    return NextResponse.json({
      application: app,
      // The raw secret is returned ONLY upon creation
      raw_client_secret: rawClientSecret
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Invalid request body' },
      { status: 400 }
    );
  }
}
