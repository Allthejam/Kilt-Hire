'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled Global Error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-lg w-full shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-center mx-auto text-rose-500">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-white">Application Error</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              A global layout error occurred. Please click below to reload the application.
            </p>
            {error?.message && (
              <div className="mt-4 p-3 bg-slate-950 border border-slate-800 rounded-xl text-left text-xs font-mono text-rose-400 overflow-x-auto">
                {error.message}
              </div>
            )}
          </div>

          <button
            onClick={() => reset()}
            className="w-full px-6 py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> Reload Portal
          </button>
        </div>
      </body>
    </html>
  );
}
