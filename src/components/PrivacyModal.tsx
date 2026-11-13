import React, { useEffect } from 'react';
import { ShieldCheck, Trash2, X } from 'lucide-react';

interface PrivacyModalProps {
  isOpen: boolean;
  sessionId: string;
  artifactCount: number;
  vectorCount: number;
  onClose: () => void;
  onPurge: () => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({
  isOpen,
  sessionId,
  artifactCount,
  vectorCount,
  onClose,
  onPurge,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Privacy Sandbox Protocols"
    >
      <div
        className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Local Privacy & Sandbox Controls
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close privacy dialog"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          <div className="grid grid-cols-3 gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 tabular-nums">
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Session Scope</div>
              <div className="font-mono font-semibold text-slate-900 dark:text-slate-100 truncate">
                {sessionId.slice(0, 12)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Buffered Files</div>
              <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                {artifactCount}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Local Vectors</div>
              <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                {vectorCount}
              </div>
            </div>
          </div>

          <ul className="space-y-2 list-disc pl-4">
            <li>
              <strong>Ephemeral Memory Isolation:</strong> Uploaded codebases, spreadsheets, PDFs, and wireframes are held strictly in ephemeral session-scoped memory—never written to disk or shared across sessions.
            </li>
            <li>
              <strong>Binary & Corrupt File Hardening:</strong> Ingestion validates magic-byte signatures (`%PDF-`, PNG/JPEG headers), null-byte binary corruption, and 20 MB ceiling limits before embedding.
            </li>
            <li>
              <strong>Server-Side Key Custody:</strong> Gemini API credentials stay strictly inside server-side routes and are never exposed to browser storage or bundles.
            </li>
            <li>
              <strong>Sandboxed Webhook Execution:</strong> Git, CI/CD, database, and task hooks are staged as inspectable JSON payloads and runnable scripts—requiring explicit operator dispatch.
            </li>
          </ul>
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              onPurge();
              onClose();
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Purge Sandbox Memory</span>
          </button>
        </div>
      </div>
    </div>
  );
};
