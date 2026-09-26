'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { copyToClipboardSafe } from '@/lib/clipboard';
import {
  Layers,
  Users,
  KeyRound,
  Key,
  Activity,
  Plus,
  ArrowRight,
  Shield,
  Copy,
  Check,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  Clock,
  Sparkles,
  ExternalLink
} from 'lucide-react';

interface Application {
  id: string;
  name: string;
  description: string | null;
  client_id: string;
  status: 'active' | 'inactive' | 'revoked';
  created_at: string;
  api_keys?: [{ count: number }];
  redirect_urls?: [{ count: number }];
  webhooks?: [{ count: number }];
}

interface ActivityLog {
  id: string;
  application_id: string | null;
  event: string;
  metadata: any;
  created_at: string;
}

export default function DashboardOverviewPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [totalKeys, setTotalKeys] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalLicenses, setTotalLicenses] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create Application Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [appName, setAppName] = useState('');
  const [appDescription, setAppDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Created credentials modal state
  const [createdResult, setCreatedResult] = useState<{
    application: Application;
    rawSecret: string;
  } | null>(null);
  const [copiedClientId, setCopiedClientId] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [showSecret, setShowSecret] = useState(true);

  async function loadDashboardData() {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch applications
      const appsRes = await fetch('/api/applications');
      if (!appsRes.ok) throw new Error('Failed to load applications');
      const appsData = await appsRes.json();
      const apps: Application[] = appsData.applications || [];
      setApplications(apps);

      // Compute total API keys across apps
      let keyCount = 0;
      apps.forEach((app) => {
        if (app.api_keys && app.api_keys[0]) {
          keyCount += app.api_keys[0].count;
        }
      });
      setTotalKeys(keyCount);

      // 2. Fetch users count
      try {
        const usersRes = await fetch('/api/users');
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setTotalUsers(usersData.users?.length || 0);
        }
      } catch (e) {
        console.error('Failed to load users count:', e);
      }

      // 3. Fetch licenses count
      try {
        const licRes = await fetch('/api/licenses?limit=1');
        if (licRes.ok) {
          const licData = await licRes.json();
          setTotalLicenses(licData.total || 0);
        }
      } catch (e) {
        console.error('Failed to load licenses count:', e);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to initialize dashboard');
    } finally {
      setIsLoading(false);
    }
  }


  useEffect(() => {
    loadDashboardData();
  }, []);

  async function handleCreateApplication(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: appName.trim(),
          description: appDescription.trim() || null
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create application');
      }

      // Show created modal with credentials
      setCreatedResult({
        application: data.application,
        rawSecret: data.raw_client_secret
      });

      // Reset form
      setAppName('');
      setAppDescription('');
      setIsModalOpen(false);

      // Refresh list
      loadDashboardData();
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const activeApps = applications.filter((a) => a.status === 'active');

  return (
    <div className="space-y-8">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222222] pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            Dashboard Overview
          </h1>
          <p className="mt-1 text-sm text-[#727275]">
            Manage single-owner authentication services, apps, and credentials.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard/licenses"
            className="inline-flex items-center justify-center gap-2 bg-[#1a1a1a] hover:bg-[#252525] border border-[#2a2a2a] text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-all cursor-pointer"
          >
            <KeyRound className="h-4 w-4 text-[#ff5f15]" />
            <span>Manage Licenses</span>
          </Link>
          <Link
            href="/dashboard/users"
            className="inline-flex items-center justify-center gap-2 bg-[#1a1a1a] hover:bg-[#252525] border border-[#2a2a2a] text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-all cursor-pointer"
          >
            <Users className="h-4 w-4 text-[#ff5f15]" />
            <span>Manage Users</span>
          </Link>
          <button
            onClick={() => {
              setCreateError(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 bg-[#ff5f15] hover:bg-[#e0500e] text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-all shadow-lg active:scale-[0.99] cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Create Application</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-900/50 flex items-center gap-3 text-red-300 text-sm">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Apps */}
        <Link
          href="/dashboard/applications"
          className="bg-[#111111] hover:bg-[#151515] border border-[#222222] hover:border-[#333333] rounded-2xl p-5 relative overflow-hidden transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-[#727275]">
              Applications
            </span>
            <div className="h-8 w-8 rounded-xl bg-[#161616] border border-[#222222] flex items-center justify-center text-[#ff5f15]">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-bold text-white">
              {isLoading ? (
                <span className="animate-pulse">--</span>
              ) : (
                applications.length
              )}
            </p>
            <p className="text-xs text-[#727275] mt-1 group-hover:text-[#ff5f15] transition-colors flex items-center gap-1">
              Registered identity clients <ArrowRight className="h-3 w-3 inline" />
            </p>
          </div>
        </Link>

        {/* End Users */}
        <Link
          href="/dashboard/users"
          className="bg-[#111111] hover:bg-[#151515] border border-[#222222] hover:border-[#333333] rounded-2xl p-5 relative overflow-hidden transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-[#727275]">
              End Users
            </span>
            <div className="h-8 w-8 rounded-xl bg-[#161616] border border-[#222222] flex items-center justify-center text-[#ff5f15]">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-bold text-white">
              {isLoading ? (
                <span className="animate-pulse">--</span>
              ) : (
                totalUsers
              )}
            </p>
            <p className="text-xs text-[#727275] mt-1 group-hover:text-[#ff5f15] transition-colors flex items-center gap-1">
              Application user pool <ArrowRight className="h-3 w-3 inline" />
            </p>
          </div>
        </Link>


        {/* API Keys */}
        <div className="bg-[#111111] border border-[#222222] rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-[#727275]">
              API Keys
            </span>
            <div className="h-8 w-8 rounded-xl bg-[#161616] border border-[#222222] flex items-center justify-center text-[#008cff]">
              <Key className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-bold text-white">
              {isLoading ? (
                <span className="animate-pulse">--</span>
              ) : (
                totalKeys
              )}
            </p>
            <p className="text-xs text-[#727275] mt-1">Active bearer tokens</p>
          </div>
        </div>

        {/* Licenses */}
        <Link
          href="/dashboard/licenses"
          className="bg-[#111111] hover:bg-[#151515] border border-[#222222] hover:border-[#333333] rounded-2xl p-5 relative overflow-hidden transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-[#727275]">
              Licenses
            </span>
            <div className="h-8 w-8 rounded-xl bg-[#161616] border border-[#222222] flex items-center justify-center text-[#ff5f15]">
              <KeyRound className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-bold text-white">
              {isLoading ? (
                <span className="animate-pulse">--</span>
              ) : (
                totalLicenses
              )}
            </p>
            <p className="text-xs text-[#727275] mt-1 group-hover:text-[#ff5f15] transition-colors flex items-center gap-1">
              Active license keys <ArrowRight className="h-3 w-3 inline" />
            </p>
          </div>
        </Link>
      </div>

      {/* Applications Section */}
      <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6">
        <div className="flex items-center justify-between border-b border-[#222222] pb-4 mb-5">
          <div>
            <h2 className="text-base font-semibold text-white">Applications</h2>
            <p className="text-xs text-[#727275]">
              OAuth 2.0 and API client applications registered under your account.
            </p>
          </div>
          <Link
            href="/dashboard/applications"
            className="text-xs font-medium text-[#ff5f15] hover:text-[#e0500e] flex items-center gap-1 transition-colors"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-[#727275] gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-[#ff5f15]" />
            <p className="text-xs">Loading applications...</p>
          </div>
        ) : applications.length === 0 ? (
          <div className="py-12 px-4 rounded-xl border border-dashed border-[#222222] text-center flex flex-col items-center justify-center">
            <div className="h-12 w-12 rounded-2xl bg-[#161616] border border-[#222222] flex items-center justify-center text-[#727275] mb-3">
              <Layers className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-white">
              No applications created yet
            </h3>
            <p className="text-xs text-[#727275] max-w-sm mt-1 mb-4">
              Create your first application to generate Client IDs, Client
              Secrets, and API keys for authentication.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 bg-[#ff5f15] hover:bg-[#e0500e] text-white px-4 py-2 rounded-xl text-xs font-medium transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Application
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {applications.slice(0, 6).map((app) => (
              <Link
                key={app.id}
                href={`/dashboard/applications/${app.id}`}
                className="group block p-4 rounded-xl bg-[#141414] border border-[#222222] hover:border-[#ff5f15]/50 transition-all hover:bg-[#181818]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white group-hover:text-[#ff5f15] transition-colors truncate">
                      {app.name}
                    </h3>
                    <p className="text-xs text-[#727275] mt-1 line-clamp-1">
                      {app.description || 'No description provided'}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                      app.status === 'active'
                        ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50'
                        : 'bg-red-950/40 text-red-400 border-red-900/50'
                    }`}
                  >
                    {app.status}
                  </span>
                </div>

                <div className="mt-4 pt-3 border-t border-[#1f1f1f] flex items-center justify-between text-xs text-[#727275]">
                  <span className="font-mono text-[11px]">
                    {app.client_id.slice(0, 16)}...
                  </span>
                  <span className="flex items-center gap-1 group-hover:text-white transition-colors">
                    Manage <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick Start / Documentation preview */}
      <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#ff5f15] uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5" />
            Developer Integration
          </div>
          <h3 className="text-base font-bold text-white">
            Authenticate APIs with RISHABH JH10C AUTH
          </h3>
          <p className="text-xs text-[#727275] max-w-xl">
            Validate requests securely using client credentials or cryptographically
            hashed bearer API keys via standard HTTP endpoints.
          </p>
        </div>

        <Link
          href="/dashboard/docs"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#161616] hover:bg-[#1f1f1f] text-white border border-[#222222] text-xs font-medium transition-all shrink-0"
        >
          View Documentation <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* CREATE APPLICATION MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5">
            <div className="border-b border-[#222222] pb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="h-5 w-5 text-[#ff5f15]" />
                Create New Application
              </h2>
              <p className="text-xs text-[#727275] mt-1">
                Configure a new application identity client for API authentication.
              </p>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-900/50 flex items-start gap-2.5 text-xs text-red-300">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateApplication} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#727275] uppercase tracking-wider mb-2">
                  Application Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Production Backend Service"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className="w-full bg-[#161616] border border-[#222222] focus:border-[#ff5f15] focus:outline-none rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#444444] transition-colors"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#727275] uppercase tracking-wider mb-2">
                  Description (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Service managing secure internal webhooks and sync APIs"
                  value={appDescription}
                  onChange={(e) => setAppDescription(e.target.value)}
                  className="w-full bg-[#161616] border border-[#222222] focus:border-[#ff5f15] focus:outline-none rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#444444] transition-colors resize-none"
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#222222]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-[#727275] hover:text-white transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !appName.trim()}
                  className="inline-flex items-center gap-2 bg-[#ff5f15] hover:bg-[#e0500e] text-white px-5 py-2 rounded-xl text-xs font-medium transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Application'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREDENTIALS PRESENTATION MODAL (ONLY ON CREATION) */}
      {createdResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6">
            <div className="border-b border-[#222222] pb-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-900/50">
                Application Created Successfully
              </span>
              <h2 className="text-xl font-bold text-white mt-2">
                {createdResult.application.name}
              </h2>
              <p className="text-xs text-[#727275] mt-1">
                Save your Client Secret immediately. For security, it will{' '}
                <strong className="text-white">never be displayed again</strong>.
              </p>
            </div>

            <div className="space-y-4">
              {/* Application ID */}
              <div>
                <label className="block text-[11px] font-mono text-[#727275] uppercase tracking-wider mb-1.5">
                  Application ID
                </label>
                <div className="flex items-center gap-2 bg-[#161616] border border-[#222222] rounded-xl px-3 py-2 text-xs font-mono text-white">
                  <span className="flex-1 truncate">
                    {createdResult.application.id}
                  </span>
                </div>
              </div>

              {/* Client ID */}
              <div>
                <label className="block text-[11px] font-mono text-[#727275] uppercase tracking-wider mb-1.5">
                  Client ID
                </label>
                <div className="flex items-center gap-2 bg-[#161616] border border-[#222222] rounded-xl px-3 py-2 text-xs font-mono text-white">
                  <span className="flex-1 truncate">
                    {createdResult.application.client_id}
                  </span>
                  <button
                    onClick={async () => {
                      const ok = await copyToClipboardSafe(
                        createdResult.application.client_id
                      );
                      if (ok) {
                        setCopiedClientId(true);
                        setTimeout(() => setCopiedClientId(false), 2000);
                      }
                    }}
                    className="p-1 rounded text-[#727275] hover:text-white transition-colors"
                    title="Copy Client ID"
                  >
                    {copiedClientId ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Client Secret */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-mono text-[#ff5f15] uppercase tracking-wider">
                    Client Secret (Copy Now)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="text-[11px] text-[#727275] hover:text-white flex items-center gap-1"
                  >
                    {showSecret ? (
                      <>
                        <EyeOff className="h-3 w-3" /> Hide
                      </>
                    ) : (
                      <>
                        <Eye className="h-3 w-3" /> Show
                      </>
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-2 bg-[#161616] border border-[#ff5f15]/40 rounded-xl px-3 py-2 text-xs font-mono text-white">
                  <span className="flex-1 truncate font-mono text-[#ff5f15]">
                    {showSecret
                      ? createdResult.rawSecret
                      : '•'.repeat(createdResult.rawSecret.length)}
                  </span>
                  <button
                    onClick={async () => {
                      const ok = await copyToClipboardSafe(createdResult.rawSecret);
                      if (ok) {
                        setCopiedSecret(true);
                        setTimeout(() => setCopiedSecret(false), 2000);
                      }
                    }}
                    className="p-1 rounded text-[#ff5f15] hover:text-white transition-colors"
                    title="Copy Client Secret"
                  >
                    {copiedSecret ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#222222]">
              <button
                onClick={() => setCreatedResult(null)}
                className="bg-[#ff5f15] hover:bg-[#e0500e] text-white px-5 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-md"
              >
                I Have Stored My Credentials Securely
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
