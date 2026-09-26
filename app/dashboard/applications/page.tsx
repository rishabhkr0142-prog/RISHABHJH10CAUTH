'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { copyToClipboardSafe } from '@/lib/clipboard';
import {
  Layers,
  Plus,
  Search,
  ArrowRight,
  Shield,
  Key,
  Webhook,
  Link2,
  Calendar,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  Eye,
  EyeOff,
  Trash2,
  AlertTriangle,
  CheckCircle2
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

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create Application Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [appName, setAppName] = useState('');
  const [appDescription, setAppDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Created credentials modal
  const [createdResult, setCreatedResult] = useState<{
    application: Application;
    rawSecret: string;
  } | null>(null);
  const [copiedClientId, setCopiedClientId] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [showSecret, setShowSecret] = useState(true);

  // Delete Application Modal State
  const [appToDelete, setAppToDelete] = useState<Application | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  async function loadApplications() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/applications');
      if (!res.ok) throw new Error('Failed to load applications');
      const data = await res.json();
      setApplications(data.applications || []);
    } catch (err: any) {
      setError(err.message || 'Error loading applications');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadApplications();
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
      if (!res.ok) throw new Error(data.error || 'Failed to create application');

      setCreatedResult({
        application: data.application,
        rawSecret: data.raw_client_secret
      });

      setAppName('');
      setAppDescription('');
      setIsModalOpen(false);
      loadApplications();
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteApplication() {
    if (!appToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/applications/${appToDelete.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete application');
      }
      setToastMessage(data.message || `Application "${appToDelete.name}" was deleted successfully.`);
      const deletedId = appToDelete.id;
      setAppToDelete(null);
      setApplications((prev) => prev.filter((a) => a.id !== deletedId));
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setDeleteError(err.message || 'Error deleting application');
    } finally {
      setIsDeleting(false);
    }
  }

  const filtered = applications.filter(
    (app) =>
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.client_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222222] pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            Applications
          </h1>
          <p className="mt-1 text-sm text-[#727275]">
            Manage client identity applications, credentials, and redirect endpoints.
          </p>
        </div>

        <button
          onClick={() => {
            setCreateError(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 bg-[#ff5f15] hover:bg-[#e0500e] text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-all shadow-md active:scale-[0.99] cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Create Application</span>
        </button>
      </div>

      {/* Success Toast */}
      {toastMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-900/60 text-emerald-300 text-xs font-medium flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-white/60 hover:text-white text-xs font-semibold ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-900/50 flex items-center gap-3 text-red-300 text-sm">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-3 bg-[#111111] border border-[#222222] rounded-xl px-3.5 py-2">
        <Search className="h-4 w-4 text-[#727275]" />
        <input
          type="text"
          placeholder="Filter applications by name or Client ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent text-sm text-white placeholder-[#444444] focus:outline-none w-full"
        />
      </div>

      {/* Applications List */}
      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center text-[#727275] gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-[#ff5f15]" />
          <p className="text-xs">Loading application records...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 px-4 rounded-2xl bg-[#111111] border border-dashed border-[#222222] text-center flex flex-col items-center justify-center">
          <div className="h-12 w-12 rounded-2xl bg-[#161616] border border-[#222222] flex items-center justify-center text-[#727275] mb-3">
            <Layers className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-white">
            {searchQuery ? 'No matching applications found' : 'No applications created yet'}
          </h3>
          <p className="text-xs text-[#727275] max-w-sm mt-1 mb-4">
            {searchQuery
              ? 'Try modifying your search query or clear the filter.'
              : 'Create an application to generate credentials and configure endpoints.'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 bg-[#ff5f15] hover:bg-[#e0500e] text-white px-4 py-2 rounded-xl text-xs font-medium transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Application
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((app) => {
            const keyCount = app.api_keys?.[0]?.count ?? 0;
            const redirectCount = app.redirect_urls?.[0]?.count ?? 0;
            const webhookCount = app.webhooks?.[0]?.count ?? 0;

            return (
              <Link
                key={app.id}
                href={`/dashboard/applications/${app.id}`}
                className="group flex flex-col justify-between p-5 rounded-2xl bg-[#111111] border border-[#222222] hover:border-[#ff5f15]/50 transition-all hover:bg-[#141414]"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-base font-semibold text-white group-hover:text-[#ff5f15] transition-colors truncate">
                      {app.name}
                    </h3>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                          app.status === 'active'
                            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50'
                            : 'bg-red-950/40 text-red-400 border-red-900/50'
                        }`}
                      >
                        {app.status}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDeleteError(null);
                          setAppToDelete(app);
                        }}
                        className="p-1 rounded-lg text-[#727275] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                        title="Delete Application"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-[#727275] line-clamp-2 min-h-[32px]">
                    {app.description || 'No description provided.'}
                  </p>

                  <div className="mt-4 p-2.5 rounded-xl bg-[#161616] border border-[#222222]">
                    <span className="block text-[10px] font-mono text-[#727275] uppercase tracking-wider mb-0.5">
                      Client ID
                    </span>
                    <span className="block text-xs font-mono text-white truncate">
                      {app.client_id}
                    </span>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-[#1f1f1f] flex items-center justify-between text-xs text-[#727275]">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1" title={`${keyCount} API Keys`}>
                      <Key className="h-3.5 w-3.5 text-[#008cff]" />
                      <span>{keyCount}</span>
                    </span>
                    <span className="flex items-center gap-1" title={`${redirectCount} Redirect URLs`}>
                      <Link2 className="h-3.5 w-3.5 text-[#ff5f15]" />
                      <span>{redirectCount}</span>
                    </span>
                    <span className="flex items-center gap-1" title={`${webhookCount} Webhooks`}>
                      <Webhook className="h-3.5 w-3.5 text-purple-400" />
                      <span>{webhookCount}</span>
                    </span>
                  </div>

                  <span className="flex items-center gap-1 text-[#ff5f15] group-hover:translate-x-0.5 transition-transform text-xs font-medium">
                    Manage <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

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
                  placeholder="e.g. Analytics Ingestion API"
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
                  placeholder="e.g. High-throughput event ingestion client"
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

      {/* CREDENTIALS PRESENTATION MODAL */}
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
                Your application credentials are ready. You can view, copy, or regenerate them anytime in Application Credentials.
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

      {/* DELETE APPLICATION CONFIRMATION MODAL */}
      {appToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#161616] border border-red-950/60 p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Delete Application?</h3>
                <p className="text-xs text-red-400">Permanent and irreversible</p>
              </div>
            </div>

            <p className="text-sm text-[#aaaaaa] leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-white">{appToDelete.name}</strong>?
            </p>

            <div className="p-3.5 rounded-xl bg-[#111111] border border-[#222222] text-xs text-[#727275] space-y-1.5">
              <p className="font-medium text-[#aaaaaa]">The following records will be permanently deleted:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                <li>Client ID: <span className="font-mono text-[#ff5f15]">{appToDelete.client_id}</span></li>
                <li>All software licenses & seller keys</li>
                <li>All application end users & password credentials</li>
                <li>All associated API keys & tokens</li>
                <li>All webhooks & redirect URLs</li>
                <li>All activity and audit log entries</li>
              </ul>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#222222]">
              <button
                type="button"
                onClick={() => setAppToDelete(null)}
                className="px-4 py-2.5 rounded-xl bg-[#1f1f1f] hover:bg-[#282828] text-xs font-semibold text-[#888888] hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteApplication}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-semibold text-white transition-all shadow-[0_0_15px_rgba(220,38,38,0.3)] cursor-pointer disabled:opacity-50 inline-flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Deleting Application...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    Permanently Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
