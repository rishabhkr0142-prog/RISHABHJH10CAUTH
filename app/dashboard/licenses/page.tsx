'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { copyToClipboardSafe } from '@/lib/clipboard';
import { AVAILABLE_SUBSCRIPTIONS, getSubscriptionDetails } from '@/lib/subscriptions';
import GenerateLicenseModal from '@/components/generate-license-modal';
import LicenseDetailsModal, { type LicenseDetailData } from '@/components/license-details-modal';
import RevokeLicenseModal from '@/components/revoke-license-modal';
import {
  KeyRound,
  Search,
  Plus,
  Filter,
  RefreshCw,
  Copy,
  Check,
  Eye,
  Ban,
  AlertCircle,
  AlertTriangle,
  Clock,
  Laptop,
  Layers,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

interface Application {
  id: string;
  name: string;
  client_id: string;
}

export default function LicensesPage() {
  const [licenses, setLicenses] = useState<LicenseDetailData[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAppId, setSelectedAppId] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedSubscription, setSelectedSubscription] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  // Modals
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [activeDetailsLicense, setActiveDetailsLicense] = useState<LicenseDetailData | null>(null);
  const [activeRevokeLicense, setActiveRevokeLicense] = useState<LicenseDetailData | null>(null);

  // Inline copy state for license key
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  async function fetchLicenses(page: number = currentPage) {
    setIsLoading(true);
    setError(null);
    setTableMissing(false);

    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (selectedAppId !== 'all') params.set('application_id', selectedAppId);
      if (selectedStatus !== 'all') params.set('status', selectedStatus);
      if (selectedSubscription !== 'all') params.set('subscription', selectedSubscription);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await fetch(`/api/licenses?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        if (data.code === 'TABLE_MISSING') {
          setTableMissing(true);
        }
        throw new Error(data.error || 'Failed to load licenses');
      }

      setLicenses(data.licenses || []);
      setTotalCount(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setCurrentPage(data.page || 1);

      if (data.applications) {
        setApplications(data.applications);
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching licenses');
    } finally {
      setIsLoading(false);
    }
  }

  // Reload when filters change
  useEffect(() => {
    setCurrentPage(1);
    fetchLicenses(1);
  }, [selectedAppId, selectedStatus, selectedSubscription]);

  async function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCurrentPage(1);
    fetchLicenses(1);
  }

  async function handleCopyKey(key: string, id: string) {
    const ok = await copyToClipboardSafe(key);
    if (ok) {
      setCopiedKeyId(id);
      setTimeout(() => setCopiedKeyId(null), 2000);
    }
  }

  function handleLicensesGenerated(newLicenses: any[]) {
    fetchLicenses(1);
    showToast(`Successfully generated ${newLicenses.length} license${newLicenses.length > 1 ? 's' : ''}`);
  }

  function handleLicenseRevoked(revokedLicense: any) {
    setLicenses((prev) =>
      prev.map((lic) => (lic.id === revokedLicense.id ? { ...lic, status: 'revoked' } : lic))
    );
    showToast('License was successfully revoked.');
  }

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }

  function formatDate(iso: string | null | undefined): string {
    if (!iso) return 'Never';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return iso;
    }
  }

  function renderStatusBadge(status: string) {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Active
          </span>
        );
      case 'used':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-950/60 text-blue-400 border border-blue-800/60">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
            Used
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/60 text-amber-400 border border-amber-800/60">
            Expired
          </span>
        );
      case 'revoked':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-950/60 text-red-400 border border-red-800/60">
            Revoked
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs text-zinc-400 bg-zinc-800">
            {status}
          </span>
        );
    }
  }

  // Quick statistics calculation
  const activeCount = licenses.filter((l) => l.status === 'active').length;
  const usedCount = licenses.filter((l) => l.status === 'used').length;
  const revokedCount = licenses.filter((l) => l.status === 'revoked').length;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#1c1c1c] border border-emerald-800/60 text-white shadow-2xl animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222222] pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <KeyRound className="h-6 w-6 text-[#ff5f15]" />
            Licenses
          </h1>
          <p className="mt-1 text-sm text-[#727275]">
            Generate and manage software license keys, expiration terms, and Multi-HWID device authorizations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchLicenses(currentPage)}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-[#1a1a1a] hover:bg-[#242424] border border-[#2a2a2a] text-[#888888] hover:text-white transition-colors cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsGenerateOpen(true)}
            className="inline-flex items-center justify-center gap-2 bg-[#ff5f15] hover:bg-[#e0500e] text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-all shadow-lg active:scale-[0.99] cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>+ Generate License</span>
          </button>
        </div>
      </div>

      {/* Migration Notice if table does not exist */}
      {tableMissing && (
        <div className="p-5 rounded-2xl bg-amber-950/30 border border-amber-800/50 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-amber-300">
                Database Setup Required: Table &quot;licenses&quot;
              </h3>
              <p className="text-xs text-amber-300/80 leading-relaxed">
                The database table for License Management has not yet been created in your Supabase project.
                Run the idempotent migration located in{' '}
                <code className="bg-amber-950/80 px-1.5 py-0.5 rounded text-amber-200 font-mono text-[11px]">
                  supabase/migrations/20260926140000_create_licenses.sql
                </code>{' '}
                in your Supabase SQL Editor to enable full license tracking.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => {
                fetch('/supabase/migrations/20260926140000_create_licenses.sql')
                  .then((r) => r.text())
                  .then((sql) => {
                    copyToClipboardSafe(sql);
                    showToast('Migration SQL copied to clipboard! Paste it into Supabase SQL Editor.');
                  })
                  .catch(() => {
                    showToast('Refer to supabase/migrations/20260926140000_create_licenses.sql in workspace.');
                  });
              }}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-black transition-colors cursor-pointer"
            >
              Copy Migration SQL
            </button>
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-amber-300 hover:underline flex items-center gap-1"
            >
              Open Supabase Dashboard <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}

      {error && !tableMissing && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-900/50 flex items-center gap-3 text-red-300 text-xs">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111111] border border-[#222222] rounded-2xl p-4">
          <span className="text-[10px] font-mono uppercase text-[#727275]">
            Total Licenses
          </span>
          <p className="text-2xl font-bold text-white mt-1">{totalCount}</p>
          <span className="text-[11px] text-[#727275]">Across selected filters</span>
        </div>

        <div className="bg-[#111111] border border-[#222222] rounded-2xl p-4">
          <span className="text-[10px] font-mono uppercase text-emerald-400">
            Active Keys
          </span>
          <p className="text-2xl font-bold text-white mt-1">{activeCount}</p>
          <span className="text-[11px] text-emerald-400/70">Ready for activation</span>
        </div>

        <div className="bg-[#111111] border border-[#222222] rounded-2xl p-4">
          <span className="text-[10px] font-mono uppercase text-blue-400">
            Used / Activated
          </span>
          <p className="text-2xl font-bold text-white mt-1">{usedCount}</p>
          <span className="text-[11px] text-blue-400/70">Device HWID attached</span>
        </div>

        <div className="bg-[#111111] border border-[#222222] rounded-2xl p-4">
          <span className="text-[10px] font-mono uppercase text-red-400">
            Revoked
          </span>
          <p className="text-2xl font-bold text-white mt-1">{revokedCount}</p>
          <span className="text-[11px] text-red-400/70">Access blocked</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#111111] border border-[#222222] rounded-2xl p-4 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666666]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by license key or note..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#161616] border border-[#282828] text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#ff5f15]/50 transition-colors"
            />
          </div>

          {/* Application filter */}
          <div className="w-full md:w-48">
            <select
              value={selectedAppId}
              onChange={(e) => setSelectedAppId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#161616] border border-[#282828] text-xs text-white focus:outline-none focus:border-[#ff5f15]/50 transition-colors cursor-pointer"
            >
              <option value="all">All Applications</option>
              {applications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="w-full md:w-36">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#161616] border border-[#282828] text-xs text-white focus:outline-none focus:border-[#ff5f15]/50 transition-colors cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="used">Used</option>
              <option value="expired">Expired</option>
              <option value="revoked">Revoked</option>
            </select>
          </div>

          {/* Subscription filter */}
          <div className="w-full md:w-40">
            <select
              value={selectedSubscription}
              onChange={(e) => setSelectedSubscription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#161616] border border-[#282828] text-xs text-white focus:outline-none focus:border-[#ff5f15]/50 transition-colors cursor-pointer"
            >
              <option value="all">All Subscriptions</option>
              {AVAILABLE_SUBSCRIPTIONS.map((tier) => (
                <option key={tier.id} value={tier.id}>
                  {tier.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-[#1f1f1f] hover:bg-[#282828] border border-[#333333] text-xs font-medium text-white transition-colors cursor-pointer"
          >
            Filter
          </button>
        </form>
      </div>

      {/* Licenses Table */}
      <div className="bg-[#111111] border border-[#222222] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#222222] bg-[#141414] text-[11px] font-semibold text-[#727275] uppercase tracking-wider">
                <th className="px-5 py-3.5">License Key</th>
                <th className="px-4 py-3.5">Subscription</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Created</th>
                <th className="px-4 py-3.5">Expiry</th>
                <th className="px-4 py-3.5">Allowed Devices</th>
                <th className="px-4 py-3.5">Used Devices</th>
                <th className="px-4 py-3.5">Note</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e1e] text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-[#727275]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="h-6 w-6 border-2 border-[#ff5f15] border-t-transparent rounded-full animate-spin" />
                      <span>Loading licenses...</span>
                    </div>
                  </td>
                </tr>
              ) : licenses.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-[#727275]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <KeyRound className="h-8 w-8 text-[#444444]" />
                      <p className="text-sm font-medium text-zinc-400">No licenses found</p>
                      <p className="text-xs text-[#666666] max-w-sm">
                        {searchQuery || selectedStatus !== 'all' || selectedSubscription !== 'all'
                          ? 'Try adjusting your search criteria or filter options.'
                          : 'Get started by clicking "+ Generate License" above.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                licenses.map((lic) => {
                  const subDetails = getSubscriptionDetails(lic.subscription);
                  const isCopied = copiedKeyId === lic.id;

                  return (
                    <tr
                      key={lic.id}
                      className="hover:bg-[#161616]/70 transition-colors group"
                    >
                      {/* License Key */}
                      <td className="px-5 py-3.5 font-mono text-white">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold tracking-wide select-all">
                            {lic.license_key}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyKey(lic.license_key, lic.id)}
                            className="p-1 rounded text-[#666666] hover:text-white transition-colors cursor-pointer"
                            title="Copy key"
                          >
                            {isCopied ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                        {lic.application && (
                          <span className="text-[10px] text-[#666666]">
                            {lic.application.name}
                          </span>
                        )}
                      </td>

                      {/* Subscription */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold font-mono border ${subDetails.badgeColor}`}
                        >
                          {subDetails.name}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">{renderStatusBadge(lic.status)}</td>

                      {/* Created */}
                      <td className="px-4 py-3.5 text-[#aaaaaa] font-mono text-[11px]">
                        {formatDate(lic.created_at)}
                      </td>

                      {/* Expiry */}
                      <td className="px-4 py-3.5 text-[#aaaaaa] font-mono text-[11px]">
                        {formatDate(lic.expires_at)}
                      </td>

                      {/* Allowed Devices */}
                      <td className="px-4 py-3.5 text-zinc-300 font-mono font-medium">
                        {lic.allowed_devices} {lic.allowed_devices === 1 ? 'device' : 'devices'}
                      </td>

                      {/* Used Devices */}
                      <td className="px-4 py-3.5 font-mono">
                        <span
                          className={
                            lic.used_devices >= lic.allowed_devices
                              ? 'text-amber-400 font-semibold'
                              : 'text-zinc-400'
                          }
                        >
                          {lic.used_devices} / {lic.allowed_devices}
                        </span>
                      </td>

                      {/* Note */}
                      <td className="px-4 py-3.5 text-[#888888] max-w-[160px] truncate" title={lic.note || ''}>
                        {lic.note || '—'}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Copy */}
                          <button
                            type="button"
                            onClick={() => handleCopyKey(lic.license_key, lic.id)}
                            className="p-1.5 rounded-lg bg-[#1a1a1a] hover:bg-[#252525] border border-[#2a2a2a] text-[#aaaaaa] hover:text-white transition-colors cursor-pointer"
                            title="Copy License Key"
                          >
                            {isCopied ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>

                          {/* View Details */}
                          <button
                            type="button"
                            onClick={() => setActiveDetailsLicense(lic)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1a1a1a] hover:bg-[#252525] border border-[#2a2a2a] text-xs font-medium text-white transition-colors cursor-pointer"
                            title="View License Details"
                          >
                            <Eye className="h-3.5 w-3.5 text-[#008cff]" />
                            <span className="hidden sm:inline">Details</span>
                          </button>

                          {/* Revoke */}
                          {lic.status !== 'revoked' ? (
                            <button
                              type="button"
                              onClick={() => setActiveRevokeLicense(lic)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-950/30 hover:bg-red-900/40 border border-red-900/40 text-xs font-medium text-red-400 transition-colors cursor-pointer"
                              title="Revoke License"
                            >
                              <Ban className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Revoke</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-red-500/70 italic px-2 py-1">
                              Revoked
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 border-t border-[#222222] bg-[#131313] text-xs text-[#727275]">
          <div>
            Showing{' '}
            <span className="text-white font-medium">
              {licenses.length > 0 ? (currentPage - 1) * limit + 1 : 0}
            </span>{' '}
            to{' '}
            <span className="text-white font-medium">
              {Math.min(currentPage * limit, totalCount)}
            </span>{' '}
            of <span className="text-white font-medium">{totalCount}</span> licenses
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (currentPage > 1) {
                  const newPage = currentPage - 1;
                  setCurrentPage(newPage);
                  fetchLicenses(newPage);
                }
              }}
              disabled={currentPage <= 1 || isLoading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#1a1a1a] hover:bg-[#252525] border border-[#2a2a2a] text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </button>
            <span className="px-2 text-zinc-400 font-mono">
              {currentPage} / {Math.max(1, totalPages)}
            </span>
            <button
              onClick={() => {
                if (currentPage < totalPages) {
                  const newPage = currentPage + 1;
                  setCurrentPage(newPage);
                  fetchLicenses(newPage);
                }
              }}
              disabled={currentPage >= totalPages || isLoading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#1a1a1a] hover:bg-[#252525] border border-[#2a2a2a] text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <GenerateLicenseModal
        isOpen={isGenerateOpen}
        onClose={() => setIsGenerateOpen(false)}
        onLicensesGenerated={handleLicensesGenerated}
        applications={applications}
        selectedApplicationId={selectedAppId !== 'all' ? selectedAppId : undefined}
      />

      <LicenseDetailsModal
        isOpen={Boolean(activeDetailsLicense)}
        onClose={() => setActiveDetailsLicense(null)}
        license={activeDetailsLicense}
        onRevokeClick={(lic) => setActiveRevokeLicense(lic)}
      />

      <RevokeLicenseModal
        isOpen={Boolean(activeRevokeLicense)}
        onClose={() => setActiveRevokeLicense(null)}
        license={activeRevokeLicense}
        onRevoked={handleLicenseRevoked}
      />
    </div>
  );
}
