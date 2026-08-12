'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Unhandled App Router Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-3xl p-8 max-w-lg w-full shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-center mx-auto text-rose-500">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-white">Something Went Wrong!</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            An unhandled error occurred while loading the Highland Kilt Hire portal. You can attempt to reset the application state or reload.
          </p>
          {error?.message && (
            <div className="mt-4 p-3 bg-slate-950 border border-slate-800 rounded-xl text-left text-xs font-mono text-rose-400 overflow-x-auto">
              {error.message}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> Try Again / Reset
          </button>
          <a
            href="/"
            className="w-full sm:w-auto px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-extrabold text-sm rounded-xl transition flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" /> Return to Home
          </a>
        </div>
      </div>
    </div>
  );
}
