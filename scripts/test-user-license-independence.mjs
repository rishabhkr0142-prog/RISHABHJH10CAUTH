import assert from 'assert';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { enrichUsersWithData } from '../lib/user-service.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('====================================================');
console.log(' USER & LICENSE INDEPENDENCE TEST SUITE');
console.log('====================================================\n');

// Mock data test verifying enrichUsersWithData behavior for User without License
console.log('--- Test 1: User Created Without License Enriches to license: null ---');

const testUser = {
  id: 'usr-unlicensed-001',
  application_id: 'app-test-001',
  username: 'pure_user',
  email: 'pure_user@example.com',
  password_hash: 'hashed_pw',
  status: 'active',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  last_login_at: null
};

const appRecord = {
  id: 'app-test-001',
  owner_id: 'owner-test-001',
  name: 'Test Application',
  client_id: 'cid-test-001',
  client_secret: 'sec-test-001',
  status: 'active',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

// Even if there are user.created logs, no synthetic license should ever be created
const userCreatedLogs = [
  {
    event: 'user.created',
    application_id: 'app-test-001',
    metadata: {
      userId: testUser.id,
      email: testUser.email,
      username: testUser.username
    },
    created_at: new Date().toISOString()
  }
];

// No licenses exist in the application
const emptyLicenses = [];

let enriched = enrichUsersWithData([testUser], [appRecord], emptyLicenses, userCreatedLogs);
assert.strictEqual(enriched.length, 1);
assert.strictEqual(enriched[0].license, null, 'User created without license MUST have license === null');
console.log('✓ Test 1 passed: User with no license row correctly resolves license === null (Displays "No License")');

// -----------------------------------------------------------------
console.log('\n--- Test 2: Refresh / GET Simulation Never Creates a License ---');
// Simulating multiple reads / dashboard page refreshes
for (let i = 0; i < 5; i++) {
  const readEnriched = enrichUsersWithData([testUser], [appRecord], emptyLicenses, userCreatedLogs);
  assert.strictEqual(readEnriched[0].license, null, 'Reading/refreshing must never produce a license');
}
console.log('✓ Test 2 passed: Multiple reads/refreshes safely return license === null with 0 records generated');

// -----------------------------------------------------------------
console.log('\n--- Test 3: Explicit License Creation (+1 License) ---');
const explicitLicense = {
  id: 'lic-explicit-001',
  application_id: 'app-test-001',
  license_key: 'JH10C-EXPL-0001',
  subscription: 'vip',
  status: 'active',
  allowed_devices: 2,
  used_devices: 0,
  device_hwids: [],
  note: null, // initially unassigned
  expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  revoked_at: null
};

const licensesList = [explicitLicense];

// At this point:
// Users: 1
// Licenses: 1
// BUT the license is unassigned (note: null)
enriched = enrichUsersWithData([testUser], [appRecord], licensesList, userCreatedLogs);
assert.strictEqual(enriched[0].license, null, 'Unassigned license does not attach to unrelated user');
console.log('✓ Test 3 passed: Explicit license created; unassigned license does not attach automatically');

// -----------------------------------------------------------------
console.log('\n--- Test 4: Explicit License Assignment to User ---');
// Owner explicitly assigns license by updating note with the user email
explicitLicense.note = testUser.email;
explicitLicense.updated_at = new Date().toISOString();

enriched = enrichUsersWithData([testUser], [appRecord], [explicitLicense], userCreatedLogs);
assert.notStrictEqual(enriched[0].license, null, 'User must now have assigned license');
assert.strictEqual(enriched[0].license.id, explicitLicense.id);
assert.strictEqual(enriched[0].license.subscription, 'vip');
assert.strictEqual(enriched[0].license.allowed_devices, 2);
console.log('✓ Test 4 passed: User now correctly shows assigned license after explicit assignment');

// -----------------------------------------------------------------
console.log('\n--- Test 5: Live Database Verification (if online) ---');
if (supabaseUrl && serviceKey) {
  const supabase = createClient(supabaseUrl, serviceKey);

  // 1. Get an existing application
  const { data: apps, error: aErr } = await supabase.from('applications').select('*').limit(1);
  if (!aErr && apps && apps.length > 0) {
    const liveApp = apps[0];
    const uniqueEmail = `test_indep_${Date.now()}@app.local`;

    // 2. Count licenses before
    const { count: licBefore } = await supabase
      .from('licenses')
      .select('*', { count: 'exact', head: true })
      .eq('application_id', liveApp.id);

    // 3. Create user in application_users
    const { data: newUser, error: uErr } = await supabase
      .from('application_users')
      .insert({
        application_id: liveApp.id,
        email: uniqueEmail,
        username: `user_${Date.now()}`,
        password_hash: 'dummy_hash',
        status: 'active'
      })
      .select()
      .single();

    assert(!uErr && newUser, `Failed to create user in DB: ${uErr?.message}`);
    console.log(`Created live test user: ${newUser.email}`);

    // 4. Count licenses after
    const { count: licAfter } = await supabase
      .from('licenses')
      .select('*', { count: 'exact', head: true })
      .eq('application_id', liveApp.id);

    // 5. Verify NO license was created!
    assert.strictEqual(licAfter, licBefore, `License count MUST NOT increase! Before: ${licBefore}, After: ${licAfter}`);
    console.log(`✓ Live DB verified: License count before = ${licBefore}, after = ${licAfter} (+0 licenses)`);

    // Clean up created test user
    await supabase.from('application_users').delete().eq('id', newUser.id);
    console.log('✓ Cleaned up live test user');
  } else {
    console.log('Skipping live DB check (no applications found)');
  }
} else {
  console.log('Skipping live DB check (Supabase env not configured)');
}

console.log('\n====================================================');
console.log(' ALL INDEPENDENCE TESTS PASSED SUCCESSFULLY! ✓');
console.log('====================================================\n');
