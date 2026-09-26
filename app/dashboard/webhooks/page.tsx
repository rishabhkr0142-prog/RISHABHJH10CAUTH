'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Webhook, ArrowRight, Trash2, Loader2, AlertCircle, ExternalLink } from 'lucide-react';

interface WebhookItem {
  id: string;
  url: string;
  enabled: boolean;
  created_at: string;
  application_id: string;
  application_name: string;
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Delete modal state
  const [webhookToDelete, setWebhookToDelete] = useState<WebhookItem | null>(null);
  const [isDeletingWebhook, setIsDeletingWebhook] = useState(false);
  const [deleteWebhookError, setDeleteWebhookError] = useState<string | null>(null);

  async function loadWebhooks() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/applications');
      if (!res.ok) throw new Error('Failed to load applications');
      const data = await res.json();
      const apps = data.applications || [];

      const allWebhooks: WebhookItem[] = [];
      for (const app of apps) {
        const wRes = await fetch(`/api/applications/${app.id}/webhooks`);
        if (wRes.ok) {
          const wData = await wRes.json();
          const items = (wData.webhooks || []).map((w: any) => ({
            ...w,
            application_name: app.name
          }));
          allWebhooks.push(...items);
        }
      }

      setWebhooks(allWebhooks);
    } catch (err: any) {
      setError(err.message || 'Error loading webhooks');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadWebhooks();
  }, []);

  async function handleToggleWebhook(appId: string, webhookId: string, currentEnabled: boolean) {
    try {
      const res = await fetch(`/api/applications/${appId}/webhooks/${webhookId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentEnabled })
      });
      if (!res.ok) throw new Error('Failed to toggle webhook');
      loadWebhooks();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function executeDeleteWebhook() {
    if (!webhookToDelete) return;
    setIsDeletingWebhook(true);
    setDeleteWebhookError(null);
    try {
      const res = await fetch(
        `/api/applications/${webhookToDelete.application_id}/webhooks/${webhookToDelete.id}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete webhook');
      }
      setWebhooks((prev) => prev.filter((w) => w.id !== webhookToDelete.id));
      setWebhookToDelete(null);
    } catch (err: any) {
      setDeleteWebhookError(err.message || 'Error deleting webhook');
    } finally {
      setIsDeletingWebhook(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222222] pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            Webhooks
          </h1>
          <p className="mt-1 text-sm text-[#727275]">
            Manage external HTTP webhook targets across all configured applications.
          </p>
        </div>
        <Link
          href="/dashboard/applications"
          className="inline-flex items-center gap-2 bg-[#ff5f15] hover:bg-[#e0500e] text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-all shadow-md"
        >
          <span>Configure in Application</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-900/50 flex items-center gap-3 text-red-300 text-sm">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6">
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center text-[#727275] gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-[#ff5f15]" />
            <p className="text-xs">Loading webhooks...</p>
          </div>
        ) : webhooks.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-[#161616] border border-[#222222] flex items-center justify-center text-[#727275] mx-auto">
              <Webhook className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-white">No webhooks configured yet</h3>
            <p className="text-xs text-[#727275] max-w-sm mx-auto">
              Open an application from the applications page to configure event dispatch webhooks.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#1f1f1f] border border-[#222222] rounded-xl overflow-hidden font-mono text-xs">
            {webhooks.map((w) => (
              <div
                key={w.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#141414] hover:bg-[#161616] transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-white text-xs truncate">{w.url}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border ${
                        w.enabled
                          ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                      }`}
                    >
                      {w.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-[#727275] mt-1 font-sans">
                    <span>
                      Application: <strong className="text-white">{w.application_name}</strong>
                    </span>
                    <span>Configured: {new Date(w.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/dashboard/applications/${w.application_id}`}
                    className="text-[#727275] hover:text-white flex items-center gap-1 text-[11px] font-sans mr-2"
                  >
                    View App <ExternalLink className="h-3 w-3" />
                  </Link>

                  <button
                    onClick={() => handleToggleWebhook(w.application_id, w.id, w.enabled)}
                    className="px-3 py-1.5 rounded-lg bg-[#1f1f1f] hover:bg-[#282828] text-white transition-colors text-xs font-sans"
                  >
                    {w.enabled ? 'Disable' : 'Enable'}
                  </button>

                  <button
                    onClick={() => {
                      setDeleteWebhookError(null);
                      setWebhookToDelete(w);
                    }}
                    className="p-1.5 rounded-lg text-[#727275] hover:text-red-400 hover:bg-red-950/20 transition-colors cursor-pointer"
                    title="Delete Webhook"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DELETE WEBHOOK CONFIRMATION MODAL */}
      {webhookToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-[#161616] border border-[#2a2a2a] p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Delete Webhook Endpoint?</h3>
                <p className="text-xs text-[#727275]">Permanent deletion</p>
              </div>
            </div>

            <p className="text-sm text-[#aaaaaa]">
              This webhook endpoint will be permanently deleted. This action cannot be undone.
            </p>

            <div className="p-3.5 rounded-xl bg-[#111111] border border-[#222222] space-y-1">
              <span className="text-[11px] font-medium text-[#727275]">
                Target Application: <strong className="text-white font-sans">{webhookToDelete.application_name}</strong>
              </span>
              <div className="font-mono text-xs text-white break-all pt-1">
                {webhookToDelete.url}
              </div>
            </div>

            {deleteWebhookError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {deleteWebhookError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#222222]">
              <button
                type="button"
                onClick={() => setWebhookToDelete(null)}
                disabled={isDeletingWebhook}
                className="px-4 py-2.5 rounded-xl bg-[#1f1f1f] hover:bg-[#282828] text-xs font-semibold text-[#888888] hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDeleteWebhook}
                disabled={isDeletingWebhook}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-semibold text-white transition-all shadow-[0_0_15px_rgba(220,38,38,0.2)] cursor-pointer disabled:opacity-50"
              >
                {isDeletingWebhook ? 'Deleting...' : 'Delete Webhook'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
