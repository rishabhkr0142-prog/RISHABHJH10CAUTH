import Link from 'next/link';
import { Shield } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#121212] text-white px-4">
      <div className="max-w-md w-full space-y-6 p-8 text-center bg-[#111111] border border-[#222222] rounded-2xl shadow-2xl">
        <div className="flex justify-center">
          <div className="h-14 w-14 rounded-2xl bg-[#1a1a1a] border border-[#222222] flex items-center justify-center text-[#ff5f15]">
            <Shield className="h-7 w-7" />
          </div>
        </div>
        <div className="space-y-2">
          <span className="text-xs font-mono text-[#ff5f15] uppercase tracking-wider">
            404 Error
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Page Not Found
          </h1>
          <p className="text-xs text-[#727275] leading-relaxed">
            The requested console path does not exist or has been relocated within RISHABH JH10C AUTH.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex justify-center py-2.5 px-5 border border-transparent rounded-xl text-xs font-semibold text-white bg-[#ff5f15] hover:bg-[#e0500e] transition-all shadow-md"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
