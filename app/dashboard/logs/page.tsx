'use client';

import { useState, useEffect } from 'react';
import { FileText, Search, RefreshCw, Loader2, AlertCircle, Clock, Shield } from 'lucide-react';

interface LogItem {
  id: string;
  application_id: string | null;
  application_name: string;
  event: string;
  metadata: any;
  ip_address: string | null;
  created_at: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadLogs() {
    setIsLoading(true);
    setError(null);
    try {
      const url = searchFilter
        ? `/api/logs?event=${encodeURIComponent(searchFilter)}`
        : '/api/logs';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load activity logs');
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err: any) {
      setError(err.message || 'Error loading logs');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, [searchFilter]);

  function getBadgeColor(event: string) {
    if (event.includes('created') || event.includes('added')) {
      return 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50';
    }
    if (event.includes('revoked') || event.includes('deleted')) {
      return 'bg-red-950/40 text-red-400 border-red-900/50';
    }
    if (event.includes('regenerated') || event.includes('updated')) {
      return 'bg-amber-950/40 text-amber-400 border-amber-900/50';
    }
    return 'bg-[#1a1a1a] text-[#ff5f15] border-[#ff5f15]/30';
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222222] pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            Activity Logs
          </h1>
          <p className="mt-1 text-sm text-[#727275]">
            Immutable audit record of authentication, application changes, and credential events.
          </p>
        </div>

        <button
          onClick={loadLogs}
          disabled={isLoading}
          className="inline-flex items-center gap-2 bg-[#161616] hover:bg-[#1f1f1f] border border-[#222222] text-white px-4 py-2.5 rounded-xl font-medium text-xs transition-all cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-900/50 flex items-center gap-3 text-red-300 text-sm">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-3 bg-[#111111] border border-[#222222] rounded-xl px-3.5 py-2">
        <Search className="h-4 w-4 text-[#727275]" />
        <input
          type="text"
          placeholder="Filter logs by event name (e.g. application_created, api_key_revoked)..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="bg-transparent text-sm text-white placeholder-[#444444] focus:outline-none w-full"
        />
      </div>

      <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6">
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center text-[#727275] gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-[#ff5f15]" />
            <p className="text-xs">Loading audit trail...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-[#161616] border border-[#222222] flex items-center justify-center text-[#727275] mx-auto">
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-white">No logs found</h3>
            <p className="text-xs text-[#727275] max-w-sm mx-auto">
              {searchFilter ? 'Try clearing your search query filter.' : 'Activity events will appear here as operations are performed.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#1f1f1f] border border-[#222222] rounded-xl overflow-hidden font-mono text-xs">
            {logs.map((log) => {
              const dateObj = new Date(log.created_at);
              return (
                <div
                  key={log.id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#141414] hover:bg-[#161616] transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${getBadgeColor(
                          log.event
                        )}`}
                      >
                        {log.event}
                      </span>
                      <span className="font-sans font-medium text-white text-xs">
                        {log.application_name}
                      </span>
                    </div>

                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <p className="text-[11px] text-[#727275] truncate max-w-xl">
                        {JSON.stringify(log.metadata)}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-[11px] text-[#727275] shrink-0 font-sans">
                    {log.ip_address && (
                      <span className="font-mono text-[#555]">{log.ip_address}</span>
                    )}
                    <span className="font-mono text-[#888]">
                      {dateObj.toLocaleDateString()}{' '}
                      {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
