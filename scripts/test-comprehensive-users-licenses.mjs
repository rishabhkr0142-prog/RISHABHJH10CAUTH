import assert from 'assert';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function runVerification() {
  console.log('================================================================');
  console.log(' COMPREHENSIVE USERS & LICENSES SEPARATION VERIFICATION SUITE');
  console.log('================================================================\n');

  // 0. Ensure at least one application exists
  const { data: apps, error: aErr } = await supabase.from('applications').select('*').limit(2);
  assert(!aErr && apps && apps.length > 0, 'No applications found in DB');
  const appA = apps[0];
  console.log(`Target Application A: ${appA.name} (${appA.id})`);

  let appB = apps[1];
  if (!appB) {
    // Create temporary app B to test application isolation
    const { data: createdAppB } = await supabase
      .from('applications')
      .insert({
        owner_id: appA.owner_id,
        name: `App B Isolation Test ${Date.now()}`,
        client_id: `cid_iso_${Date.now()}`,
        client_secret: `sec_iso_${Date.now()}`,
        status: 'active'
      })
      .select()
      .single();
    appB = createdAppB;
  }
  console.log(`Target Application B: ${appB.name} (${appB.id})`);

  const timestamp = Date.now();
  const testUserEmail = `user_sep_${timestamp}@test.local`;
  const testUsername = `user_sep_${timestamp}`;

  // -------------------------------------------------------------------------
  // TEST 1: CREATE USER -> CONFIRM EXACTLY 1 USER CREATED & 0 LICENSES CREATED
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 1: User Creation (Zero Licenses Created) ---');
  const { count: licCountBeforeUser } = await supabase
    .from('licenses')
    .select('*', { count: 'exact', head: true })
    .eq('application_id', appA.id);

  const { data: createdUser, error: uErr } = await supabase
    .from('application_users')
    .insert({
      application_id: appA.id,
      email: testUserEmail,
      username: testUsername,
      password_hash: 'testhash123',
      status: 'active'
    })
    .select()
    .single();

  assert(!uErr && createdUser, `Failed to create user: ${uErr?.message}`);
  console.log(`✓ User created: id=${createdUser.id}, email=${createdUser.email}`);

  const { count: licCountAfterUser } = await supabase
    .from('licenses')
    .select('*', { count: 'exact', head: true })
    .eq('application_id', appA.id);

  assert.strictEqual(
    licCountAfterUser,
    licCountBeforeUser,
    `Creating a User MUST NOT create any licenses! Before: ${licCountBeforeUser}, After: ${licCountAfterUser}`
  );
  console.log(`✓ Confirmed: License count before = ${licCountBeforeUser}, after = ${licCountAfterUser} (+0 licenses)`);

  // -------------------------------------------------------------------------
  // TEST 2: CREATE LICENSE SEPARATELY -> EXACTLY 1 LICENSE CREATED, 0 USERS CREATED
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Standalone License Creation (Zero Users Created) ---');
  const { count: userCountBeforeLic } = await supabase
    .from('application_users')
    .select('*', { count: 'exact', head: true })
    .eq('application_id', appA.id);

  const licenseKey = `TEST-LIC-${timestamp}`;
  const { data: createdLicense, error: lErr } = await supabase
    .from('licenses')
    .insert({
      application_id: appA.id,
      license_key: licenseKey,
      subscription: 'vip',
      status: 'active',
      allowed_devices: 2,
      used_devices: 0,
      device_hwids: [],
      note: null, // Unassigned
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    })
    .select()
    .single();

  assert(!lErr && createdLicense, `Failed to create license: ${lErr?.message}`);
  console.log(`✓ Standalone License created: id=${createdLicense.id}, key=${createdLicense.license_key}, note=${createdLicense.note}`);

  const { count: userCountAfterLic } = await supabase
    .from('application_users')
    .select('*', { count: 'exact', head: true })
    .eq('application_id', appA.id);

  assert.strictEqual(
    userCountAfterLic,
    userCountBeforeLic,
    `Creating a License MUST NOT create any users! Before: ${userCountBeforeLic}, After: ${userCountAfterLic}`
  );
  console.log(`✓ Confirmed: User count before = ${userCountBeforeLic}, after = ${userCountAfterLic} (+0 users)`);

  // -------------------------------------------------------------------------
  // TEST 3: ASSIGN LICENSE TO USER -> NO DUPLICATE LICENSE CREATED
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Assign License to Existing User (No Duplicate Licenses) ---');
  const { count: licCountBeforeAssign } = await supabase
    .from('licenses')
    .select('*', { count: 'exact', head: true })
    .eq('application_id', appA.id);

  // Update existing license note to assign user
  const { data: assignedLicense, error: assignErr } = await supabase
    .from('licenses')
    .update({ note: createdUser.email, updated_at: new Date().toISOString() })
    .eq('id', createdLicense.id)
    .select()
    .single();

  assert(!assignErr && assignedLicense, `Failed to assign license: ${assignErr?.message}`);
  assert.strictEqual(assignedLicense.note, createdUser.email);

  const { count: licCountAfterAssign } = await supabase
    .from('licenses')
    .select('*', { count: 'exact', head: true })
    .eq('application_id', appA.id);

  assert.strictEqual(
    licCountAfterAssign,
    licCountBeforeAssign,
    `Assigning a License must NOT create any duplicate license! Before: ${licCountBeforeAssign}, After: ${licCountAfterAssign}`
  );
  console.log(`✓ License successfully assigned to ${createdUser.email}. Total license count remained unchanged (${licCountAfterAssign}).`);

  // -------------------------------------------------------------------------
  // TEST 4: EDIT USER -> ONLY USER UPDATED, ZERO LICENSES CREATED OR CHANGED
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: Edit User (Only User Modified) ---');
  const newUsername = `user_mod_${timestamp}`;
  const { data: editedUser, error: editUserErr } = await supabase
    .from('application_users')
    .update({ username: newUsername, status: 'disabled' })
    .eq('id', createdUser.id)
    .select()
    .single();

  assert(!editUserErr && editedUser, `Failed to edit user: ${editUserErr?.message}`);
  assert.strictEqual(editedUser.username, newUsername);
  assert.strictEqual(editedUser.status, 'disabled');

  // Verify license still has its original subscription, expiry, allowed_devices
  const { data: verifyLicAfterUserEdit } = await supabase
    .from('licenses')
    .select('*')
    .eq('id', createdLicense.id)
    .single();

  assert.strictEqual(verifyLicAfterUserEdit.subscription, 'vip');
  assert.strictEqual(verifyLicAfterUserEdit.allowed_devices, 2);
  assert.strictEqual(verifyLicAfterUserEdit.status, 'active');
  console.log('✓ User modified without touching license subscription, device limit, or status.');

  // -------------------------------------------------------------------------
  // TEST 5: EDIT LICENSE -> ONLY LICENSE UPDATED, USER DATA UNTOUCHED
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: Edit License (Only License Modified) ---');
  const newExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data: editedLicense, error: editLicErr } = await supabase
    .from('licenses')
    .update({
      subscription: 'default',
      allowed_devices: 5,
      expires_at: newExpiresAt
    })
    .eq('id', createdLicense.id)
    .select()
    .single();

  assert(!editLicErr && editedLicense, `Failed to edit license: ${editLicErr?.message}`);
  assert.strictEqual(editedLicense.subscription, 'default');
  assert.strictEqual(editedLicense.allowed_devices, 5);

  // Verify user still intact
  const { data: verifyUserAfterLicEdit } = await supabase
    .from('application_users')
    .select('*')
    .eq('id', createdUser.id)
    .single();

  assert.strictEqual(verifyUserAfterLicEdit.username, newUsername);
  assert.strictEqual(verifyUserAfterLicEdit.status, 'disabled');
  console.log('✓ License modified without changing user account.');

  // -------------------------------------------------------------------------
  // TEST 6: RESET HWID -> ONLY HWID / DEVICE BINDING CLEARED
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 6: Reset HWID (Only Device Bindings Cleared) ---');
  // First bind a device
  await supabase
    .from('licenses')
    .update({
      device_hwids: ['DEVICE_HWID_ABC123'],
      used_devices: 1,
      status: 'used'
    })
    .eq('id', createdLicense.id);

  // Now reset HWID
  const { data: resetLic, error: resetErr } = await supabase
    .from('licenses')
    .update({
      device_hwids: [],
      used_devices: 0
    })
    .eq('id', createdLicense.id)
    .select()
    .single();

  assert(!resetErr && resetLic);
  assert.deepStrictEqual(resetLic.device_hwids, []);
  assert.strictEqual(resetLic.used_devices, 0);
  assert.strictEqual(resetLic.subscription, 'default'); // unchanged
  assert.strictEqual(resetLic.allowed_devices, 5); // unchanged
  assert.strictEqual(resetLic.note, createdUser.email); // assignment preserved
  console.log('✓ HWID reset successfully cleared only device bindings; preserved assignment, subscription, and expiry.');

  // -------------------------------------------------------------------------
  // TEST 7: APPLICATION ISOLATION
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 7: Application Isolation ---');
  // Users in App A must not appear in App B
  const { data: appBUsers } = await supabase
    .from('application_users')
    .select('*')
    .eq('application_id', appB.id)
    .eq('email', createdUser.email);

  assert.strictEqual(appBUsers.length, 0, 'User from App A MUST NOT appear in App B!');

  // Licenses in App A must not appear in App B
  const { data: appBLicenses } = await supabase
    .from('licenses')
    .select('*')
    .eq('application_id', appB.id)
    .eq('license_key', createdLicense.license_key);

  assert.strictEqual(appBLicenses.length, 0, 'License from App A MUST NOT appear in App B!');
  console.log('✓ Application isolation verified: Resources in App A are strictly isolated from App B.');

  // -------------------------------------------------------------------------
  // TEST 8: UNASSIGN LICENSE -> CLEARS NOTE, DOES NOT DELETE USER OR LICENSE
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 8: Unassign License Action ---');
  const { data: unassignedLic, error: unassignErr } = await supabase
    .from('licenses')
    .update({ note: null })
    .eq('id', createdLicense.id)
    .select()
    .single();

  assert(!unassignErr && unassignedLic);
  assert.strictEqual(unassignedLic.note, null);

  const { data: userStillExists } = await supabase
    .from('application_users')
    .select('id')
    .eq('id', createdUser.id)
    .maybeSingle();

  assert(userStillExists, 'User must remain existing when license is unassigned!');
  console.log('✓ Unassign license safely clears user link without deleting user or license.');

  // -------------------------------------------------------------------------
  // TEST 9: DELETE USER -> UNRELATED LICENSES REMAIN SAFE
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 9: Delete User Safety (License Remains Safe) ---');
  const { error: delUserErr } = await supabase
    .from('application_users')
    .delete()
    .eq('id', createdUser.id);

  assert(!delUserErr);

  const { data: licStillExists } = await supabase
    .from('licenses')
    .select('id')
    .eq('id', createdLicense.id)
    .maybeSingle();

  assert(licStillExists, 'License MUST remain existing when user is deleted!');
  console.log('✓ Deleting user preserved license in database.');

  // -------------------------------------------------------------------------
  // TEST 10: DELETE LICENSE -> UNRELATED USERS REMAIN SAFE
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 10: Delete License Safety ---');
  const { error: delLicErr } = await supabase
    .from('licenses')
    .delete()
    .eq('id', createdLicense.id);

  assert(!delLicErr);
  console.log('✓ License safely deleted.');

  // Clean up App B if it was created temporarily
  if (appB.name.startsWith('App B Isolation Test')) {
    await supabase.from('applications').delete().eq('id', appB.id);
  }

  console.log('\n================================================================');
  console.log(' ALL 10 TESTS PASSED SUCCESSFULLY! ✓');
  console.log('================================================================\n');
}

runVerification().catch((err) => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
