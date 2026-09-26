/**
 * Centralized Auth Server URL Configuration
 *
 * Configures the base URL for the hosted Vercel Auth Server.
 * All client and desktop application connections use this centralized definition.
 */

export const AUTH_SERVER_URL =
  process.env.NEXT_PUBLIC_AUTH_SERVER_URL ||
  process.env.BASE_URL ||
  'https://rishabhjh-10-cauth.vercel.app';

export const AUTH_ENDPOINTS = {
  BASE: AUTH_SERVER_URL,
  VALIDATE: `${AUTH_SERVER_URL}/api/auth/validate`,
  APPLICATIONS: `${AUTH_SERVER_URL}/api/applications`,
  USERS: `${AUTH_SERVER_URL}/api/users`,
  LOGS: `${AUTH_SERVER_URL}/api/logs`,
  USER: `${AUTH_SERVER_URL}/api/user`,
  SETTINGS: `${AUTH_SERVER_URL}/api/user/settings`,
} as const;

/**
 * Returns a fully qualified Auth Server URL for any endpoint path.
 * Ensures existing endpoint paths (e.g. /api/auth/validate) are preserved.
 */
export function getAuthApiUrl(path: string): string {
  const cleanBase = AUTH_SERVER_URL.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}
