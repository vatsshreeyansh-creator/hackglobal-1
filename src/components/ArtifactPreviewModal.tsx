import React, { useEffect } from 'react';
import { X, FileCode2, Table2, Image as ImageIcon, FileText, Volume2 } from 'lucide-react';
import type { IngestedArtifact } from '../types/omniagent';

interface ArtifactPreviewModalProps {
  artifact: (IngestedArtifact & { fullTextContent?: string }) | null;
  onClose: () => void;
}

export const ArtifactPreviewModal: React.FC<ArtifactPreviewModalProps> = ({
  artifact,
  onClose,
}) => {
  useEffect(() => {
    if (!artifact) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [artifact, onClose]);

  if (!artifact) return null;

  const renderIcon = () => {
    switch (artifact.modality) {
      case 'code':
        return <FileCode2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'tabular':
        return <Table2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'image':
        return <ImageIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'audio':
        return <Volume2 className="w-4 h-4 text-slate-600 dark:text-slate-300" />;
      default:
        return <FileText className="w-4 h-4 text-slate-600 dark:text-slate-300" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Inspect ${artifact.name}`}
    >
      <div
        className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            {renderIcon()}
            <div className="min-w-0">
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {artifact.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {artifact.modality} · {artifact.mimeType} · {(artifact.sizeBytes / 1024).toFixed(1)} KB ·{' '}
                {artifact.chunkCount} chunks · {artifact.embeddingDims > 0 ? `${artifact.embeddingDims}d vectors` : 'lexical'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-4">
          {artifact.errorMessage && (
            <div className="p-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
              Ingestion validation error: {artifact.errorMessage}
            </div>
          )}

          {artifact.imageDataUrl && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 flex justify-center">
              <img
                src={artifact.imageDataUrl}
                alt={artifact.name}
                referrerPolicy="no-referrer"
                className="max-h-[420px] w-auto object-contain rounded border border-slate-200 dark:border-slate-800"
              />
            </div>
          )}

          {artifact.modality === 'audio' && artifact.mediaDataUrl && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-2">
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Audio Stream Playback
              </p>
              <audio controls src={artifact.mediaDataUrl} className="w-full" />
            </div>
          )}

          {artifact.mimeType === 'application/pdf' && artifact.mediaDataUrl && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 overflow-hidden">
              <iframe
                title={artifact.name}
                src={artifact.mediaDataUrl}
                className="w-full h-[460px] bg-white"
              />
            </div>
          )}

          {artifact.tabularMeta && (
            <div className="space-y-3">
              <div className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                Sheet: <span className="font-medium text-slate-900 dark:text-slate-100">{artifact.tabularMeta.activeSheet}</span> ·{' '}
                {artifact.tabularMeta.rowCount} rows × {artifact.tabularMeta.columnCount} columns
              </div>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                <table className="w-full text-left border-collapse text-xs tabular-nums">
                  <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200">
                    <tr>
                      {artifact.tabularMeta.columns.map((col) => (
                        <th key={col.name} className="px-3 py-2 font-semibold border-b border-slate-200 dark:border-slate-700">
                          <div>{col.name}</div>
                          <div className="font-mono text-[11px] font-normal text-slate-500 dark:text-slate-400">
                            {col.inferredType} · nulls: {col.nullCount}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {artifact.tabularMeta.previewRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        {artifact.tabularMeta!.columns.map((col) => (
                          <td key={col.name} className="px-3 py-2 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {row[col.name] === null || row[col.name] === undefined
                              ? '—'
                              : String(row[col.name])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!artifact.imageDataUrl &&
            !artifact.mediaDataUrl &&
            !artifact.tabularMeta &&
            (artifact.fullTextContent || artifact.textPreview) && (
              <pre className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono text-xs leading-relaxed text-slate-800 dark:text-slate-200 overflow-x-auto whitespace-pre-wrap">
                {artifact.fullTextContent || artifact.textPreview}
              </pre>
            )}
        </div>
      </div>
    </div>
  );
};
