import assert from 'assert';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('Skipping live test: Supabase credentials not found');
  process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
  console.log('====================================================');
  console.log(' BULK DELETE & AUDIT VERIFICATION SUITE');
  console.log('====================================================');

  // 1. Fetch current applications
  const { data: apps, error: appErr } = await supabase.from('applications').select('*').limit(2);
  assert(!appErr, 'Failed to fetch applications: ' + appErr?.message);
  assert(apps && apps.length > 0, 'No applications found in DB');

  const targetApp = apps[0];
  console.log(`Using application: ${targetApp.name} (${targetApp.id})`);

  // 2. Create 2 test users in this application
  const testEmail1 = `bulk_test_1_${Date.now()}@test.com`;
  const testEmail2 = `bulk_test_2_${Date.now()}@test.com`;

  const { data: user1, error: u1Err } = await supabase
    .from('application_users')
    .insert({
      application_id: targetApp.id,
      email: testEmail1,
      username: `bulk1_${Date.now()}`,
      password_hash: 'testhash',
      status: 'active'
    })
    .select()
    .single();

  const { data: user2, error: u2Err } = await supabase
    .from('application_users')
    .insert({
      application_id: targetApp.id,
      email: testEmail2,
      username: `bulk2_${Date.now()}`,
      password_hash: 'testhash',
      status: 'active'
    })
    .select()
    .single();

  assert(!u1Err && !u2Err, 'Failed to create test users');
  console.log(`✓ Created 2 test users: ${user1.id}, ${user2.id}`);

  // 3. Create 2 test licenses
  const { data: lic1, error: l1Err } = await supabase
    .from('licenses')
    .insert({
      application_id: targetApp.id,
      license_key: `BULK-TEST-${Date.now()}-1`,
      subscription: 'default',
      status: 'active',
      allowed_devices: 1,
      used_devices: 0,
      note: testEmail1
    })
    .select()
    .single();

  const { data: lic2, error: l2Err } = await supabase
    .from('licenses')
    .insert({
      application_id: targetApp.id,
      license_key: `BULK-TEST-${Date.now()}-2`,
      subscription: 'vip',
      status: 'active',
      allowed_devices: 2,
      used_devices: 0,
      note: 'Standalone test'
    })
    .select()
    .single();

  assert(!l1Err && !l2Err, 'Failed to create test licenses');
  console.log(`✓ Created 2 test licenses: ${lic1.id}, ${lic2.id}`);

  // 4. Test User Deletion Safety: Deleting user1 must NOT delete lic1!
  // Delete user1
  const { error: delUserErr } = await supabase
    .from('application_users')
    .delete()
    .in('id', [user1.id, user2.id]);

  assert(!delUserErr, 'Failed to delete test users');
  console.log(`✓ Deleted test users: ${user1.id}, ${user2.id}`);

  // Verify lic1 still exists!
  const { data: checkLic1, error: checkLic1Err } = await supabase
    .from('licenses')
    .select('*')
    .eq('id', lic1.id)
    .single();

  assert(checkLic1 && !checkLic1Err, 'CRITICAL REGRESSION: License was deleted when user was deleted!');
  console.log('✓ License preserved when user was deleted (No cascade corruption)');

  // 5. Delete test licenses
  const { error: delLicErr } = await supabase
    .from('licenses')
    .delete()
    .in('id', [lic1.id, lic2.id]);

  assert(!delLicErr, 'Failed to delete test licenses');
  console.log('✓ Bulk deleted test licenses successfully');

  // Verify both deleted
  const { data: remainingLics } = await supabase
    .from('licenses')
    .select('id')
    .in('id', [lic1.id, lic2.id]);

  assert(!remainingLics || remainingLics.length === 0, 'Licenses should be gone');
  console.log('✓ Verified licenses no longer exist');

  console.log('====================================================');
  console.log(' ALL BULK SAFETY TESTS PASSED! ✓');
  console.log('====================================================');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
