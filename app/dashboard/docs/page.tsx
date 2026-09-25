'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Copy, Check, Terminal, Shield, Key, ArrowRight, Code, Fingerprint, Users, Layers } from 'lucide-react';
import { copyToClipboardSafe } from '@/lib/clipboard';
import { getSdkIntegrationCode, type SdkLang } from '@/lib/sdk-snippets';

interface ApplicationData {
  id: string;
  name: string;
  owner_id: string;
  client_id: string;
  client_secret?: string | null;
}

export default function DocsPage() {
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [applications, setApplications] = useState<ApplicationData[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>('');
  const [selectedApp, setSelectedApp] = useState<ApplicationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function copyCode(code: string, id: string) {
    const success = await copyToClipboardSafe(code);
    if (success) {
      setCopiedSnippet(id);
      setTimeout(() => setCopiedSnippet(null), 2000);
    }
  }

  // Load applications dynamically
  useEffect(() => {
    async function loadApps() {
      setIsLoading(true);
      try {
        const res = await fetch('/api/applications');
        const data = await res.json();
        const apps = data.applications || [];
        setApplications(apps);

        if (apps.length > 0) {
          const savedId = typeof window !== 'undefined' ? localStorage.getItem('selected_application_id') : null;
          const target = apps.find((a: ApplicationData) => a.id === savedId) || apps[0];
          setSelectedAppId(target.id);
          fetchAppDetails(target.id);
        }
      } catch (err) {
        console.error('Error fetching applications for docs:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadApps();
  }, []);

  async function fetchAppDetails(id: string) {
    try {
      const res = await fetch(`/api/applications/${id}`);
      const data = await res.json();
      if (data.application) {
        setSelectedApp(data.application);
      }
    } catch (e) {
      console.error('Error fetching app details:', e);
    }
  }

  function handleSelectApp(id: string) {
    setSelectedAppId(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('selected_application_id', id);
    }
    fetchAppDetails(id);
  }

  const credentials = {
    appName: selectedApp?.name || 'MyApp',
    ownerId: selectedApp?.owner_id || '',
    secret: selectedApp?.client_secret || '',
    version: '1.0'
  };

  const csharpSnippet = getSdkIntegrationCode('csharp', credentials);
  const pythonSnippet = getSdkIntegrationCode('python', credentials);
  const tsSnippet = getSdkIntegrationCode('typescript', credentials);
  const curlSnippet = getSdkIntegrationCode('curl', credentials);

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="border-b border-[#222222] pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#ff5f15] mb-1">
            <BookOpen className="h-4 w-4" /> Developer Documentation
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            SDK & API Guide
            {selectedApp && (
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-[#ff5f15]/10 border border-[#ff5f15]/20 text-[#ff5f15] font-semibold">
                {selectedApp.name}
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-[#727275]">
            A clean developer authentication and credential management architecture inspired by developer-first auth engines.
          </p>
        </div>

        {/* Dynamic App Selector */}
        {applications.length > 0 && (
          <div className="shrink-0 min-w-[180px]">
            <label className="block text-[10px] font-bold text-[#727275] uppercase tracking-wider mb-1">
              Active Application
            </label>
            <select
              value={selectedAppId}
              onChange={(e) => handleSelectApp(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-[#161616] border border-[#282828] text-xs font-medium text-white focus:outline-none focus:border-[#ff5f15]/50 transition-colors cursor-pointer"
            >
              {applications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 3 Identity Architecture */}
      <section className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Fingerprint className="h-4 w-4 text-[#ff5f15]" />
          Credential Architecture & Identity Separation
        </h2>
        <p className="text-xs text-[#727275] leading-relaxed">
          The authentication system enforces strict separation between three distinct identity domains:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-[#161616] border border-[#262626] space-y-1.5">
            <span className="text-[11px] font-bold text-[#ff5f15] uppercase tracking-wider block">
              1. Platform Owner
            </span>
            <p className="text-xs text-[#888888]">
              Used exclusively to manage this dashboard. Private to you. Never exposed in client code or used as an application credential.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#161616] border border-[#262626] space-y-1.5">
            <span className="text-[11px] font-bold text-white uppercase tracking-wider block">
              2. Application ID
            </span>
            <p className="text-xs text-[#888888]">
              Internal database UUID identifying the application row. Scopes users and audit records.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#161616] border border-[#262626] space-y-1.5">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
              3. Client Credentials
            </span>
            <p className="text-xs text-[#888888]">
              Cryptographic client ID and secret used by developers in <strong className="text-white">RishabhAuthClient</strong>.
            </p>
          </div>
        </div>
      </section>

      {/* Steps List */}
      <div className="space-y-6">
        {/* Step 1: C# SDK Initialization */}
        <section className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="h-7 w-7 rounded-xl bg-[#161616] border border-[#222222] flex items-center justify-center text-xs font-mono font-bold text-[#ff5f15]">
              1
            </span>
            <h2 className="text-base font-bold text-white">C# SDK Client Initialization</h2>
          </div>
          <p className="text-xs text-[#727275] leading-relaxed pl-10">
            Initialize <strong className="text-white">RishabhAuthClient</strong> dynamically using{' '}
            <code className="text-[#ff5f15]">{selectedApp?.name || 'appName'}</code> credentials.
          </p>

          <div className="pl-10 space-y-3">
            <div className="relative bg-[#161616] border border-[#222222] rounded-xl p-4 font-mono text-xs text-white">
              <button
                onClick={() => copyCode(csharpSnippet, 'csharp')}
                className="absolute right-3 top-3 p-1 rounded text-[#727275] hover:text-white cursor-pointer"
                title="Copy snippet"
              >
                {copiedSnippet === 'csharp' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
              <pre className="overflow-x-auto leading-relaxed">{csharpSnippet}</pre>
            </div>
          </div>
        </section>

        {/* Step 2: Python Example */}
        <section className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="h-7 w-7 rounded-xl bg-[#161616] border border-[#222222] flex items-center justify-center text-xs font-mono font-bold text-[#ff5f15]">
              2
            </span>
            <h2 className="text-base font-bold text-white">Python Integration</h2>
          </div>
          <div className="pl-10 space-y-3">
            <div className="relative bg-[#161616] border border-[#222222] rounded-xl p-4 font-mono text-xs text-white">
              <button
                onClick={() => copyCode(pythonSnippet, 'python')}
                className="absolute right-3 top-3 p-1 rounded text-[#727275] hover:text-white cursor-pointer"
                title="Copy snippet"
              >
                {copiedSnippet === 'python' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
              <pre className="overflow-x-auto leading-relaxed">{pythonSnippet}</pre>
            </div>
          </div>
        </section>

        {/* Step 3: TypeScript Example */}
        <section className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="h-7 w-7 rounded-xl bg-[#161616] border border-[#222222] flex items-center justify-center text-xs font-mono font-bold text-[#ff5f15]">
              3
            </span>
            <h2 className="text-base font-bold text-white">TypeScript / JavaScript</h2>
          </div>
          <div className="pl-10 space-y-3">
            <div className="relative bg-[#161616] border border-[#222222] rounded-xl p-4 font-mono text-xs text-white">
              <button
                onClick={() => copyCode(tsSnippet, 'ts')}
                className="absolute right-3 top-3 p-1 rounded text-[#727275] hover:text-white cursor-pointer"
                title="Copy snippet"
              >
                {copiedSnippet === 'ts' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
              <pre className="overflow-x-auto leading-relaxed">{tsSnippet}</pre>
            </div>
          </div>
        </section>

        {/* Step 4: HTTP API Validation */}
        <section className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="h-7 w-7 rounded-xl bg-[#161616] border border-[#222222] flex items-center justify-center text-xs font-mono font-bold text-[#ff5f15]">
              4
            </span>
            <h2 className="text-base font-bold text-white">Direct HTTP API Validation</h2>
          </div>
          <p className="text-xs text-[#727275] leading-relaxed pl-10">
            For languages without a dedicated wrapper, make a POST request to{' '}
            <code className="text-white bg-[#161616] px-2 py-0.5 rounded border border-[#222222]">
              /api/auth/validate
            </code>.
          </p>
          <div className="pl-10 space-y-3">
            <div className="relative bg-[#161616] border border-[#222222] rounded-xl p-4 font-mono text-xs text-white">
              <button
                onClick={() => copyCode(curlSnippet, 'curl')}
                className="absolute right-3 top-3 p-1 rounded text-[#727275] hover:text-white cursor-pointer"
                title="Copy snippet"
              >
                {copiedSnippet === 'curl' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
              <pre className="overflow-x-auto leading-relaxed">{curlSnippet}</pre>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
