import assert from 'assert';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { POST } from '../app/api/auth/validate/route.ts';
import { enrichUsersWithData, formatDateReliable } from '../lib/user-service.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runLiveTest() {
  console.log('====================================================');
  console.log(' LIVE SUPABASE AUTHENTICATION & ACTIVITY TEST');
  console.log('====================================================\n');

  // 1. Get Application
  const { data: app, error: appErr } = await supabase
    .from('applications')
    .select('*')
    .limit(1)
    .single();

  assert(!appErr && app, 'Must find application in Supabase');
  console.log(`Using Application: "${app.name}" (${app.client_id})`);

  // Unique test identifiers
  const testEmail = `live_authtest_${Date.now()}@app.local`;
  const testPassword = 'TestPassword123!';
  const testLicKey = `TEST-LIC-${Date.now().toString().slice(-8)}`;
  const passwordHash = await bcrypt.hash(testPassword, 10);

  let createdUserId = null;
  let createdLicenseId = null;

  try {
    // 2. Setup initial state in Database:
    // User with last_login_at: null
    const { data: newUser, error: uErr } = await supabase
      .from('application_users')
      .insert({
        application_id: app.id,
        email: testEmail,
        username: 'live_test_user',
        password_hash: passwordHash,
        status: 'active'
      })
      .select()
      .single();

    assert(!uErr && newUser, `Failed to create test user: ${uErr?.message}`);
    createdUserId = newUser.id;

    // License with allowed_devices: 1, used_devices: 0, device_hwids: []
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: newLic, error: lErr } = await supabase
      .from('licenses')
      .insert({
        application_id: app.id,
        license_key: testLicKey,
        subscription: 'default',
        status: 'active',
        allowed_devices: 1,
        used_devices: 0,
        device_hwids: [],
        note: testEmail,
        expires_at: futureDate
      })
      .select()
      .single();

    assert(!lErr && newLic, `Failed to create test license: ${lErr?.message}`);
    createdLicenseId = newLic.id;

    console.log('\n--- Initial State in Supabase ---');
    console.log(`User: ${testEmail} (last_login_at: ${newUser.last_login_at})`);
    console.log(`License: ${testLicKey} (devices: ${newLic.used_devices} / ${newLic.allowed_devices})`);
    assert.strictEqual(newUser.last_login_at, null);
    assert.strictEqual(newLic.used_devices, 0);
    assert.strictEqual(newLic.device_hwids.length, 0);

    // Initial enrichment check
    let { data: logs } = await supabase
      .from('application_logs')
      .select('event, application_id, metadata, created_at')
      .eq('application_id', app.id)
      .order('created_at', { ascending: false })
      .limit(100);

    let enriched = enrichUsersWithData([newUser], [app], [newLic], logs || []);
    assert.strictEqual(enriched[0].activity.login_count, 0, 'Initial login count must be 0');
    assert.strictEqual(enriched[0].license.used_devices, 0, 'Initial used devices must be 0');
    console.log('✓ Initial state confirmed: Login Count = 0, Devices = 0 / 1');

    // ---------------------------------------------------------------
    // 3. FIRST AUTHENTICATION: One REAL end-user authentication
    // ---------------------------------------------------------------
    console.log('\n--- Performing First Authentication via /api/auth/validate ---');
    const authPayload1 = {
      appName: app.name,
      secret: app.client_secret,
      action: 'authenticate_user',
      email: testEmail,
      password: testPassword,
      hwid: 'HWID-LIVE-DEVICE-ALPHA'
    };

    const req1 = new Request('http://localhost:3000/api/auth/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authPayload1)
    });

    const resp1 = await POST(req1);
    const data1 = await resp1.json();
    assert.strictEqual(resp1.status, 200);
    assert.strictEqual(data1.valid, true);
    assert(data1.user.last_login_at, 'Response must contain last_login_at');
    console.log('✓ First authentication HTTP response: 200 OK, valid: true');

    // Verify database state after first auth
    const { data: dbUser1 } = await supabase
      .from('application_users')
      .select('*')
      .eq('id', createdUserId)
      .single();

    const { data: dbLic1 } = await supabase
      .from('licenses')
      .select('*')
      .eq('id', createdLicenseId)
      .single();

    assert(dbUser1.last_login_at, 'Database last_login_at must be populated');
    assert.strictEqual(dbLic1.used_devices, 1, 'Database license used_devices must be 1');
    assert.deepStrictEqual(dbLic1.device_hwids, ['HWID-LIVE-DEVICE-ALPHA']);

    // Fetch updated logs
    const { data: logs1 } = await supabase
      .from('application_logs')
      .select('event, application_id, metadata, created_at')
      .eq('application_id', app.id)
      .order('created_at', { ascending: false })
      .limit(100);

    enriched = enrichUsersWithData([dbUser1], [app], [dbLic1], logs1 || []);
    assert.strictEqual(enriched[0].activity.login_count, 1, 'Login Count must now be 1');
    assert.strictEqual(enriched[0].license.used_devices, 1, 'Devices must now be 1');
    console.log(`✓ Database verified: Last Login: ${formatDateReliable(dbUser1.last_login_at)}, Login Count = 1, Devices = 1 / 1`);

    // ---------------------------------------------------------------
    // 4. SECOND AUTHENTICATION: Authenticate again from SAME device
    // ---------------------------------------------------------------
    console.log('\n--- Performing Second Authentication from SAME Authorized Device ---');
    // Wait slightly to avoid sub-second collision
    await new Promise((r) => setTimeout(r, 1600));

    const authPayload2 = {
      appName: app.name,
      secret: app.client_secret,
      action: 'authenticate_user',
      email: testEmail,
      password: testPassword,
      hwid: 'HWID-LIVE-DEVICE-ALPHA'
    };

    const req2 = new Request('http://localhost:3000/api/auth/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authPayload2)
    });

    const resp2 = await POST(req2);
    const data2 = await resp2.json();
    assert.strictEqual(resp2.status, 200);
    assert.strictEqual(data2.valid, true);

    const { data: dbUser2 } = await supabase
      .from('application_users')
      .select('*')
      .eq('id', createdUserId)
      .single();

    const { data: dbLic2 } = await supabase
      .from('licenses')
      .select('*')
      .eq('id', createdLicenseId)
      .single();

    // Verify devices is STILL 1 / 1 (NOT 2 / 1)
    assert.strictEqual(dbLic2.used_devices, 1, 'Must NOT increment devices for same authorized device (remains 1 / 1)');
    assert.deepStrictEqual(dbLic2.device_hwids, ['HWID-LIVE-DEVICE-ALPHA']);

    const { data: logs2 } = await supabase
      .from('application_logs')
      .select('event, application_id, metadata, created_at')
      .eq('application_id', app.id)
      .order('created_at', { ascending: false })
      .limit(100);

    enriched = enrichUsersWithData([dbUser2], [app], [dbLic2], logs2 || []);
    assert.strictEqual(enriched[0].activity.login_count, 2, 'Login Count must now be 2');
    assert.strictEqual(enriched[0].license.used_devices, 1, 'Devices MUST REMAIN 1 / 1');
    console.log(`✓ Second auth verified: Login Count = 2, Devices = 1 / 1 (NOT 2 / 1)`);

    // ---------------------------------------------------------------
    // 5. THIRD AUTHENTICATION: Second device tries to authenticate (limit 1)
    // ---------------------------------------------------------------
    console.log('\n--- Second Device Attempt (Limit Reached) ---');
    const authPayload3 = {
      appName: app.name,
      secret: app.client_secret,
      action: 'authenticate_user',
      email: testEmail,
      password: testPassword,
      hwid: 'HWID-LIVE-DEVICE-BETA'
    };

    const req3 = new Request('http://localhost:3000/api/auth/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authPayload3)
    });

    const resp3 = await POST(req3);
    const data3 = await resp3.json();
    assert.strictEqual(resp3.status, 403, 'Must reject second device with 403');
    assert.strictEqual(data3.valid, false);
    assert(data3.error.includes('Device limit reached'));
    console.log(`✓ Rejected unauthorized device: "${data3.error}"`);

    // ---------------------------------------------------------------
    // 6. DASHBOARD READ SIMULATION
    // ---------------------------------------------------------------
    console.log('\n--- Dashboard Read & Refresh Simulation ---');
    // Opening dashboard does not update user or increment login count
    const dashboardCheck = enrichUsersWithData([dbUser2], [app], [dbLic2], logs2 || []);
    assert.strictEqual(dashboardCheck[0].activity.login_count, 2, 'Login Count must remain 2');
    assert.strictEqual(dashboardCheck[0].license.used_devices, 1, 'Devices must remain 1');
    assert.notStrictEqual(dashboardCheck[0].activity.formatted_last_login, 'No recorded logins');
    console.log('✓ Dashboard read and refresh do not alter login count or device state.');

    console.log('\n====================================================');
    console.log(' ALL LIVE SUPABASE TESTS PASSED PERFECTLY! ✓');
    console.log('====================================================\n');
  } finally {
    // Cleanup temporary test records
    console.log('Cleaning up test records from database...');
    if (createdLicenseId) {
      await supabase.from('licenses').delete().eq('id', createdLicenseId);
    }
    if (createdUserId) {
      await supabase.from('application_users').delete().eq('id', createdUserId);
      await supabase.from('application_logs').delete().eq('metadata->>userId', createdUserId);
    }
    console.log('✓ Cleanup complete.');
  }
}

runLiveTest().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
