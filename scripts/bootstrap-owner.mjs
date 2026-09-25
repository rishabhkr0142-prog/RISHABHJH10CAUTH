import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exitCode = 1;
} else {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  async function bootstrap() {
    const args = process.argv.slice(2);
    const email = args[0] || process.env.OWNER_EMAIL || 'owner@rishabh.local';
    const password = args[1] || process.env.OWNER_PASSWORD || 'Password123!';

    console.log(`Checking existing owner profiles in database...`);
    const { data: existingProfiles, error: profileErr } = await supabase
      .from('profiles')
      .select('*');

    if (profileErr) {
      console.error(
        'Database query error: ' + profileErr.message + '\n\n' +
        '-> To fix: Open Supabase Dashboard > SQL Editor, and execute the SQL script in supabase/schema.sql'
      );
      process.exitCode = 1;
      return;
    }

    if (existingProfiles && existingProfiles.length > 0) {
      console.log(`An owner already exists in the system: ${existingProfiles[0].email} (ID: ${existingProfiles[0].id})`);
      console.log('No additional owner can be created. System is strictly single-owner.');
      return;
    }

    console.log(`Querying Supabase Auth for existing user with email: ${email}...`);
    const { data: usersData } = await supabase.auth.admin.listUsers();
    const existingUser = usersData?.users.find((u) => u.email === email);

    if (existingUser) {
      console.log(`Found existing auth user (${existingUser.id}). Assigning OWNER role in profiles...`);
      const { data: profile, error: insertErr } = await supabase.from('profiles').insert({
        id: existingUser.id,
        email: existingUser.email,
        display_name: existingUser.user_metadata?.display_name || 'Owner',
        role: 'OWNER'
      }).select().single();

      if (insertErr) {
        console.error('Failed to insert into profiles:', insertErr.message);
        process.exitCode = 1;
      } else {
        console.log('Owner profile created successfully:', profile);
      }
      return;
    }

    console.log(`Creating owner user in Supabase Auth: ${email}...`);
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: 'Owner' }
    });

    if (authError) {
      console.error('Failed to create auth user:', authError.message);
      process.exitCode = 1;
      return;
    }

    if (authData?.user) {
      console.log(`Owner account created in auth.users with ID: ${authData.user.id}`);
      const { data: profile, error: insertErr } = await supabase.from('profiles').insert({
        id: authData.user.id,
        email: authData.user.email,
        display_name: 'Owner',
        role: 'OWNER'
      }).select().single();

      if (insertErr) {
        console.error('Failed to link profile:', insertErr.message);
        process.exitCode = 1;
      } else {
        console.log('Owner profile created successfully:', profile);
      }
    }
  }

  bootstrap().catch((err) => {
    console.error('Bootstrap failed:', err);
    process.exitCode = 1;
  });
}
