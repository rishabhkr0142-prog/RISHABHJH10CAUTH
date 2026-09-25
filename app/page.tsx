import { redirect } from 'next/navigation';
import { getOwnerUser } from '@/lib/supabase/auth';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const auth = await getOwnerUser();
  if (auth) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}
