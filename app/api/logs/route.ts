import { NextResponse } from 'next/server';
import { getOwnerUser } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const auth = await getOwnerUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const eventFilter = searchParams.get('event');
  const supabase = await createClient();

  // First fetch owner's application IDs
  const { data: apps } = await supabase
    .from('applications')
    .select('id, name')
    .eq('owner_id', auth.profile.id);

  const appMap = new Map<string, string>();
  const appIds: string[] = [];
  (apps || []).forEach((a) => {
    appIds.push(a.id);
    appMap.set(a.id, a.name);
  });

  // Query application logs
  let query = supabase
    .from('application_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (eventFilter) {
    query = query.ilike('event', `%${eventFilter}%`);
  }

  const { data: logs, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const enhancedLogs = (logs || []).map((l) => ({
    ...l,
    application_name: l.application_id
      ? appMap.get(l.application_id) || 'Unknown Application'
      : 'System / Auth'
  }));

  return NextResponse.json({ logs: enhancedLogs });
}
