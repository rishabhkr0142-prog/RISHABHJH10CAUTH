'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { verifyOwnerStatus, logApplicationEvent } from '@/lib/supabase/auth';

export async function signInAction(prevState: any, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const redirectPath = (formData.get('redirect') as string) || '/dashboard';

  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password
  });

  if (error || !data.user) {
    return {
      error: error?.message?.includes('Invalid login credentials')
        ? 'Invalid email or password. Please verify your credentials.'
        : error?.message || 'Authentication failed.'
    };
  }

  // Perform server-side database owner verification
  const verification = await verifyOwnerStatus(data.user);
  if (!verification.success) {
    // Sign out unauthorized user immediately
    await supabase.auth.signOut();
    return {
      error: verification.message
    };
  }

  // Log successful login
  await logApplicationEvent({
    applicationId: null,
    event: 'owner_login',
    metadata: { email: data.user.email, timestamp: new Date().toISOString() }
  });

  redirect(redirectPath);
}
