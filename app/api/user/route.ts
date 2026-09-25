import { NextResponse } from 'next/server';
import { getOwnerUser } from '@/lib/supabase/auth';

export async function GET() {
  const auth = await getOwnerUser();
  if (!auth) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({
    user: {
      id: auth.profile.id,
      email: auth.profile.email,
      name: auth.profile.display_name || auth.profile.email.split('@')[0],
      role: auth.profile.role
    }
  });
}
