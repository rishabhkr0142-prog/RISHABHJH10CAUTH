'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Code2,
  Copy,
  Check,
  Terminal,
  Shield,
  Key,
  Layers,
  Users,
  Eye,
  EyeOff,
  UserPlus,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { copyToClipboardSafe } from '@/lib/clipboard';
import { getSdkIntegrationCode, getSdkFileName, type SdkLang } from '@/lib/sdk-snippets';
import CreateUserModal, { type ApplicationOption } from '@/components/create-user-modal';

interface ApplicationData {
  id: string;
  name: string;
  client_id: string;
  owner_id: string;
  client_secret?: string | null;
  status: string;
}

export default function IntegrationPage() {
  const [applications, setApplications] = useState<ApplicationData[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>('');
  const [selectedApp, setSelectedApp] = useState<ApplicationData | null>(null);
  const [isLoadingApps, setIsLoadingApps] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeLang, setActiveLang] = useState<SdkLang>('csharp');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  // Create User modal state
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load all applications
  async function fetchApplications() {
    setIsLoadingApps(true);
    setError(null);
    try {
      const res = await fetch('/api/applications');
      if (!res.ok) throw new Error('Failed to load applications');
      const data = await res.json();
      const apps = data.applications || [];
      setApplications(apps);

      if (apps.length > 0) {
        // Retrieve last saved selection or default to first
        const savedId = typeof window !== 'undefined' ? localStorage.getItem('selected_application_id') : null;
        const target = apps.find((a: ApplicationData) => a.id === savedId) || apps[0];
        setSelectedAppId(target.id);
        fetchApplicationDetails(target.id);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading applications');
    } finally {
      setIsLoadingApps(false);
    }
  }

  // Load detailed credentials for selected application
  async function fetchApplicationDetails(appId: string) {
    setIsLoadingDetails(true);
    try {
      const res = await fetch(`/api/applications/${appId}`);
      if (!res.ok) throw new Error('Failed to fetch application details');
      const data = await res.json();
      if (data.application) {
        setSelectedApp(data.application);
      }
    } catch (err: any) {
      console.error('Error loading app details:', err);
    } finally {
      setIsLoadingDetails(false);
    }
  }

  useEffect(() => {
    fetchApplications();
  }, []);

  function handleSelectApplication(appId: string) {
    setSelectedAppId(appId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('selected_application_id', appId);
    }
    fetchApplicationDetails(appId);
  }

  async function handleCopy(text: string, id: string) {
    const success = await copyToClipboardSafe(text);
    if (success) {
      setCopiedKey(id);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  }

  const sdkLanguages: Array<{ id: SdkLang; label: string }> = [
    { id: 'csharp', label: 'C#' },
    { id: 'python', label: 'Python' },
    { id: 'typescript', label: 'TypeScript' },
    { id: 'javascript', label: 'JavaScript' },
    { id: 'cpp', label: 'C++' },
    { id: 'java', label: 'Java' },
    { id: 'go', label: 'Go' },
    { id: 'rust', label: 'Rust' },
    { id: 'php', label: 'PHP' },
    { id: 'vbnet', label: 'VB.Net' },
    { id: 'ruby', label: 'Ruby' },
    { id: 'perl', label: 'Perl' },
    { id: 'lua', label: 'Lua' },
    { id: 'curl', label: 'cURL / HTTP' }
  ];

  const currentCode = getSdkIntegrationCode(activeLang, {
    appName: selectedApp?.name || 'MyApp',
    ownerId: selectedApp?.owner_id || '',
    secret: selectedApp?.client_secret || '',
    version: '1.0'
  });

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Header & Application Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222222] pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#ff5f15] mb-1">
            <Code2 className="h-4 w-4" /> SDK & API Integration
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            Integration Guide
            {selectedApp && (
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-[#ff5f15]/10 border border-[#ff5f15]/20 text-[#ff5f15] font-semibold">
                {selectedApp.name}
              </span>
            )}
          </h1>
          <p className="mt-1 text-xs text-[#727275]">
            Configure and authenticate client applications dynamically using real cryptographic credentials.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Dynamic Application Selector */}
          <div className="relative min-w-[200px]">
            <select
              value={selectedAppId}
              onChange={(e) => handleSelectApplication(e.target.value)}
              disabled={isLoadingApps || applications.length === 0}
              className="w-full px-3.5 py-2 rounded-xl bg-[#161616] border border-[#282828] text-xs font-medium text-white focus:outline-none focus:border-[#ff5f15]/50 transition-colors cursor-pointer disabled:opacity-50"
            >
              {applications.length === 0 ? (
                <option value="">No applications found</option>
              ) : (
                applications.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* New User Button */}
          <button
            onClick={() => setIsCreateUserModalOpen(true)}
            disabled={!selectedApp}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#ff5f15] hover:bg-[#e04f0f] text-xs font-semibold text-white transition-all shadow-[0_0_15px_rgba(255,95,21,0.2)] cursor-pointer disabled:opacity-50 shrink-0"
          >
            <UserPlus className="h-4 w-4" />
            New User
          </button>
        </div>
      </div>

      {toastMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-between">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Selected Application Credentials Box */}
      <div className="p-5 rounded-2xl bg-[#161616] border border-[#222222] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-[#ff5f15]" />
            <h2 className="text-sm font-bold text-white">Active Credentials</h2>
          </div>
          {isLoadingDetails && (
            <div className="flex items-center gap-1.5 text-xs text-[#727275]">
              <RefreshCw className="h-3 w-3 animate-spin text-[#ff5f15]" /> Loading details...
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Application Name */}
          <div className="p-3 bg-[#111111] rounded-xl border border-[#242424] space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#727275]">Application Name</span>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-white font-medium truncate">
                {selectedApp?.name || '—'}
              </span>
              <button
                onClick={() => handleCopy(selectedApp?.name || '', 'name')}
                className="text-[#727275] hover:text-white p-1 cursor-pointer"
                title="Copy name"
              >
                {copiedKey === 'name' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* Owner ID */}
          <div className="p-3 bg-[#111111] rounded-xl border border-[#242424] space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#727275]">Owner ID</span>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-white truncate max-w-[140px]">
                {selectedApp?.owner_id || '—'}
              </span>
              <button
                onClick={() => handleCopy(selectedApp?.owner_id || '', 'owner')}
                className="text-[#727275] hover:text-white p-1 cursor-pointer"
                title="Copy Owner ID"
              >
                {copiedKey === 'owner' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* Client Secret */}
          <div className="p-3 bg-[#111111] rounded-xl border border-[#242424] space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#727275]">Client Secret</span>
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-mono text-white truncate max-w-[120px]">
                {showSecret
                  ? selectedApp?.client_secret || '—'
                  : selectedApp?.client_secret
                  ? '••••••••••••••••'
                  : '—'}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowSecret(!showSecret)}
                  className="text-[#727275] hover:text-white p-1 cursor-pointer"
                  title={showSecret ? 'Hide secret' : 'Show secret'}
                >
                  {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => handleCopy(selectedApp?.client_secret || '', 'secret')}
                  className="text-[#727275] hover:text-white p-1 cursor-pointer"
                  title="Copy Secret"
                >
                  {copiedKey === 'secret' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* SDK Version */}
          <div className="p-3 bg-[#111111] rounded-xl border border-[#242424] space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#727275]">Version</span>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-white">1.0</span>
              <span className="text-[10px] font-mono text-emerald-400">Stable</span>
            </div>
          </div>
        </div>
      </div>

      {/* Code Snippets Section */}
      <div className="p-6 rounded-2xl bg-[#161616] border border-[#222222] space-y-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Terminal className="h-4 w-4 text-[#ff5f15]" />
            Generated Integration Code
          </h2>
          <p className="text-xs text-[#727275] mt-1">
            Ready-to-use authentication snippets bound to <strong className="text-white">{selectedApp?.name || 'the selected application'}</strong>.
          </p>
        </div>

        {/* Language Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#111111] rounded-xl border border-[#222222]">
          {sdkLanguages.map((lang) => (
            <button
              key={lang.id}
              onClick={() => setActiveLang(lang.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                activeLang === lang.id
                  ? 'bg-[#ff5f15] text-white'
                  : 'text-[#888888] hover:text-white hover:bg-[#1a1a1a]'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>

        {/* Code Box */}
        <div className="relative rounded-xl bg-[#0d0d0d] border border-[#262626] p-4 overflow-x-auto">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#222222]">
            <div className="flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5 text-[#ff5f15]" />
              <span className="text-xs font-mono text-[#888888]">
                {getSdkFileName(activeLang)}
              </span>
            </div>
            <button
              onClick={() => handleCopy(currentCode, 'snippet')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1c1c1c] hover:bg-[#282828] text-xs font-semibold text-[#888888] hover:text-white transition-colors cursor-pointer"
            >
              {copiedKey === 'snippet' ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copiedKey === 'snippet' ? 'Copied' : 'Copy Snippet'}
            </button>
          </div>

          <pre className="font-mono text-xs text-[#e6e6e6] leading-relaxed whitespace-pre overflow-x-auto">
            {currentCode}
          </pre>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      <CreateUserModal
        isOpen={isCreateUserModalOpen}
        onClose={() => setIsCreateUserModalOpen(false)}
        selectedApplicationId={selectedAppId}
        applications={applications.map((a) => ({ id: a.id, name: a.name, client_id: a.client_id }))}
        onUserCreated={(newUser) => {
          setToastMessage(`User "${newUser.username || newUser.email}" successfully created for ${selectedApp?.name || 'application'}!`);
          setTimeout(() => setToastMessage(null), 4000);
        }}
      />
    </div>
  );
}
