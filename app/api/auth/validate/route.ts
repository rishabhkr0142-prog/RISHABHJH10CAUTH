import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashSecret, verifySecret, verifyUserPassword } from '@/lib/crypto';
import type { ApiKey, Application, EndUser, License } from '@/lib/supabase/types';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const body = await request.json().catch(() => ({}));
    const admin = createAdminClient();

    // Check for API key (Bearer token or body.api_key)
    const apiKey =
      body.api_key ||
      (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null);

    if (apiKey) {
      const keyHash = hashSecret(apiKey);

      const { data: keyRecord, error: keyErr } = await admin
        .from('api_keys')
        .select('*')
        .eq('key_hash', keyHash)
        .single();

      if (keyErr || !keyRecord) {
        return NextResponse.json(
          { valid: false, error: 'Invalid API key' },
          { status: 401 }
        );
      }

      const key = keyRecord as ApiKey;

      if (key.revoked_at) {
        return NextResponse.json(
          { valid: false, error: 'API key has been revoked' },
          { status: 403 }
        );
      }

      const { data: appRecord, error: appErr } = await admin
        .from('applications')
        .select('*')
        .eq('id', key.application_id)
        .single();

      if (appErr || !appRecord) {
        return NextResponse.json(
          { valid: false, error: 'Associated application not found' },
          { status: 404 }
        );
      }

      const app = appRecord as Application;

      if (app.status !== 'active') {
        return NextResponse.json(
          { valid: false, error: 'Application is inactive or revoked' },
          { status: 403 }
        );
      }

      // Update last_used_at asynchronously
      await admin
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', key.id);

      return NextResponse.json({
        valid: true,
        type: 'api_key',
        key_id: key.id,
        application: {
          id: app.id,
          name: app.name,
          client_id: app.client_id,
          status: app.status
        }
      });
    }

    // Check for Application Credentials (supports appName + secret OR client_id + client_secret)
    const secret = body.secret || body.client_secret;
    const clientId = body.client_id;
    const appName = body.appName || body.app_name;
    const { action, email, password } = body;

    if (secret && (clientId || appName)) {
      let query = admin.from('applications').select('*');
      if (clientId) {
        query = query.eq('client_id', clientId);
      } else if (appName) {
        query = query.eq('name', appName);
      }

      const { data: appRecord, error: appErr } = await query.limit(1).maybeSingle();

      if (appErr || !appRecord) {
        return NextResponse.json(
          { valid: false, error: 'Invalid client credentials' },
          { status: 401 }
        );
      }

      const app = appRecord as Application;

      if (app.status !== 'active') {
        return NextResponse.json(
          { valid: false, error: 'Application is inactive or revoked' },
          { status: 403 }
        );
      }

      const isValidSecret =
        (app.client_secret && app.client_secret === secret) ||
        (Boolean(app.client_secret_hash) && verifySecret(secret, app.client_secret_hash!));

      if (!isValidSecret) {
        return NextResponse.json(
          { valid: false, error: 'Invalid client credentials' },
          { status: 401 }
        );
      }

      // End-User Authentication action
      if (action === 'authenticate_user') {
        const identifier = String(email || body.username || '').trim();
        if (!identifier || !password) {
          return NextResponse.json(
            { valid: false, error: 'Email/username and password are required for user authentication' },
            { status: 400 }
          );
        }

        let userRecord: EndUser | null = null;
        const cleanIdentifier = identifier.toLowerCase();

        if (cleanIdentifier.includes('@')) {
          const { data } = await admin
            .from('application_users')
            .select('*')
            .eq('application_id', app.id)
            .eq('email', cleanIdentifier)
            .maybeSingle();
          userRecord = data as EndUser | null;
        } else {
          // Check username first, then fallback to email (e.g. username@app.local)
          const { data: byUsername } = await admin
            .from('application_users')
            .select('*')
            .eq('application_id', app.id)
            .eq('username', identifier)
            .maybeSingle();

          if (byUsername) {
            userRecord = byUsername as EndUser;
          } else {
            const { data: byEmail } = await admin
              .from('application_users')
              .select('*')
              .eq('application_id', app.id)
              .or(`email.eq.${cleanIdentifier},email.eq.${cleanIdentifier}@app.local`)
              .maybeSingle();
            userRecord = byEmail as EndUser | null;
          }
        }

        if (!userRecord) {
          return NextResponse.json(
            { valid: false, error: 'Invalid email or password' },
            { status: 401 }
          );
        }

        const user = userRecord as EndUser;

        if (user.status !== 'active') {
          return NextResponse.json(
            { valid: false, error: `User account is ${user.status}` },
            { status: 403 }
          );
        }

        const isPasswordCorrect = await verifyUserPassword(password, user.password_hash);
        if (!isPasswordCorrect) {
          return NextResponse.json(
            { valid: false, error: 'Invalid email or password' },
            { status: 401 }
          );
        }

        const loginTimestamp = new Date().toISOString();
        await admin
          .from('application_users')
          .update({ last_login_at: loginTimestamp })
          .eq('id', user.id);

        await admin.from('application_logs').insert({
          application_id: app.id,
          event: 'user.login_success',
          metadata: {
            userId: user.id,
            email: user.email,
            clientId: app.client_id
          }
        });

        return NextResponse.json({
          valid: true,
          type: 'user_authentication',
          user: {
            id: user.id,
            application_id: user.application_id,
            email: user.email,
            username: user.username,
            status: user.status,
            created_at: user.created_at,
            last_login_at: loginTimestamp
          },
          application: {
            id: app.id,
            name: app.name,
            client_id: app.client_id
          }
        });
      }

      // License Authentication / Validation action
      if (action === 'validate_license' || body.license_key) {
        const rawKey = String(body.license_key || body.license || '').trim();
        const hwid = body.hwid ? String(body.hwid).trim() : null;

        if (!rawKey) {
          return NextResponse.json(
            { valid: false, error: 'License key is required' },
            { status: 400 }
          );
        }

        const { data: licenseRecord, error: licErr } = await admin
          .from('licenses')
          .select('*')
          .eq('application_id', app.id)
          .eq('license_key', rawKey)
          .maybeSingle();

        if (licErr || !licenseRecord) {
          return NextResponse.json(
            { valid: false, error: 'Invalid license key' },
            { status: 401 }
          );
        }

        const license = licenseRecord as License;

        if (license.status === 'revoked') {
          return NextResponse.json(
            { valid: false, error: 'License has been revoked' },
            { status: 403 }
          );
        }

        const now = new Date();
        if (license.expires_at && new Date(license.expires_at) < now) {
          if (license.status !== 'expired') {
            await admin
              .from('licenses')
              .update({ status: 'expired', updated_at: now.toISOString() })
              .eq('id', license.id);
          }
          return NextResponse.json(
            { valid: false, error: 'License has expired', expires_at: license.expires_at },
            { status: 403 }
          );
        }

        // Multi-HWID validation
        const currentHwids = license.device_hwids || [];
        let updatedHwids = [...currentHwids];
        let usedDevices = license.used_devices || currentHwids.length;

        if (hwid) {
          const hwidKnown = currentHwids.includes(hwid);
          if (!hwidKnown) {
            if (usedDevices >= license.allowed_devices) {
              return NextResponse.json(
                {
                  valid: false,
                  error: `Device limit reached. License is limited to ${license.allowed_devices} device(s).`
                },
                { status: 403 }
              );
            }
            updatedHwids.push(hwid);
            usedDevices = updatedHwids.length;
            await admin
              .from('licenses')
              .update({
                device_hwids: updatedHwids,
                used_devices: usedDevices,
                status: 'used',
                updated_at: new Date().toISOString()
              })
              .eq('id', license.id);
          }
        }

        await admin.from('application_logs').insert({
          application_id: app.id,
          event: 'license.validated',
          metadata: {
            licenseId: license.id,
            subscription: license.subscription,
            hwid: hwid ? `${hwid.slice(0, 4)}...` : null
          }
        });

        return NextResponse.json({
          valid: true,
          type: 'license_validation',
          license: {
            id: license.id,
            license_key: license.license_key,
            subscription: license.subscription,
            status: license.status === 'active' && hwid ? 'used' : license.status,
            expires_at: license.expires_at,
            allowed_devices: license.allowed_devices,
            used_devices: usedDevices
          },
          application: {
            id: app.id,
            name: app.name,
            client_id: app.client_id
          }
        });
      }

      const { data: redirectUrls } = await admin
        .from('redirect_urls')
        .select('id, url')
        .eq('application_id', app.id);

      return NextResponse.json({
        valid: true,
        type: 'client_credentials',
        application: {
          id: app.id,
          name: app.name,
          client_id: app.client_id,
          status: app.status,
          redirect_urls: redirectUrls || []
        }
      });
    }

    return NextResponse.json(
      {
        valid: false,
        error:
          'Provide either { appName, secret }, { client_id, client_secret }, or { api_key } / Authorization: Bearer <key>'
      },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { valid: false, error: error.message || 'Validation failed' },
      { status: 500 }
    );
  }
}
