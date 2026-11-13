import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  FileCode2,
  FileText,
  FolderPlus,
  Image as ImageIcon,
  Layers,
  Table2,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react';
import type { IngestedArtifact, SessionStateResponse } from '../types/omniagent';

interface IngestionPanelProps {
  artifacts: IngestedArtifact[];
  vectorStats: SessionStateResponse['vectorStats'];
  isUploading: boolean;
  isLoadingSample: boolean;
  onUploadFiles: (files: FileList | File[]) => void;
  onLoadSample: () => void;
  onInspectArtifact: (artifactId: string) => void;
  onDeleteArtifact: (artifactId: string) => void;
}

export const IngestionPanel: React.FC<IngestionPanelProps> = ({
  artifacts,
  vectorStats,
  isUploading,
  isLoadingSample,
  onUploadFiles,
  onLoadSample,
  onInspectArtifact,
  onDeleteArtifact,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadFiles(e.dataTransfer.files);
    }
  };

  const renderModalityIcon = (modality: IngestedArtifact['modality']) => {
    switch (modality) {
      case 'code':
        return <FileCode2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />;
      case 'tabular':
        return <Table2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />;
      case 'image':
        return <ImageIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />;
      case 'audio':
        return <Volume2 className="w-4 h-4 text-slate-600 dark:text-slate-300 shrink-0" />;
      default:
        return <FileText className="w-4 h-4 text-slate-600 dark:text-slate-300 shrink-0" />;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <aside className="w-full lg:w-[290px] xl:w-[310px] shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div>
          <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
            Multimodal Context
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Local sandbox vector store
          </p>
        </div>
        <button
          type="button"
          onClick={onLoadSample}
          disabled={isLoadingSample || isUploading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800/80 rounded-md transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          <span>{isLoadingSample ? 'Loading...' : 'Load Sample'}</span>
        </button>
      </div>

      {/* Drag and drop zone */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          aria-label="Upload multi-modal artifacts"
          className={`rounded-lg border border-dashed p-4 text-center cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
            isDragging
              ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/30'
              : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50/70 dark:bg-slate-950/50'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            accept=".py,.js,.jsx,.ts,.tsx,.cpp,.cc,.c,.h,.go,.rs,.java,.sql,.sh,.yaml,.yml,.json,.md,.txt,.pdf,.csv,.tsv,.xlsx,.xls,.png,.jpg,.jpeg,.webp,.mp3,.wav,.ogg,.m4a,.webm"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onUploadFiles(e.target.files);
                e.target.value = '';
              }
            }}
          />
          <Upload className="w-5 h-5 mx-auto mb-2 text-slate-500 dark:text-slate-400" />
          <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
            {isUploading ? 'Ingesting & indexing...' : 'Drop artifacts or browse'}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            PDF, Code, CSV/XLSX, PNG/JPG, Audio
          </p>
        </div>
      </div>

      {/* Artifact list */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
        {artifacts.length === 0 ? (
          <div className="p-6 text-center space-y-2">
            <Layers className="w-6 h-6 mx-auto text-slate-400 dark:text-slate-600" />
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
              No artifacts in sandbox
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Upload source files, telemetry spreadsheets, PDFs, or wireframes, or load the sample engineering bundle.
            </p>
          </div>
        ) : (
          artifacts.map((art) => (
            <div
              key={art.id}
              className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="mt-0.5">{renderModalityIcon(art.modality)}</div>
                  <div className="min-w-0">
                    <p
                      title={art.name}
                      className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate"
                    >
                      {art.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      {art.modality} · {formatBytes(art.sizeBytes)} · {art.chunkCount}{' '}
                      {art.chunkCount === 1 ? 'chunk' : 'chunks'}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                      {art.status === 'indexed' && (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                            Indexed
                          </span>
                        </>
                      )}
                      {art.status === 'fallback' && (
                        <>
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span className="text-amber-700 dark:text-amber-400 font-medium">
                            Lexical fallback
                          </span>
                        </>
                      )}
                      {art.status === 'error' && (
                        <>
                          <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
                          <span className="text-red-700 dark:text-red-400 font-medium">
                            Rejected
                          </span>
                        </>
                      )}
                    </div>
                    {art.errorMessage && (
                      <p className="mt-1 text-[11px] text-red-600 dark:text-red-400 leading-snug">
                        {art.errorMessage}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {art.status !== 'error' && (
                    <button
                      type="button"
                      onClick={() => onInspectArtifact(art.id)}
                      title={`Inspect ${art.name}`}
                      aria-label={`Inspect ${art.name}`}
                      className="p-1.5 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-700/70 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDeleteArtifact(art.id)}
                    title={`Remove ${art.name}`}
                    aria-label={`Remove ${art.name}`}
                    className="p-1.5 rounded text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Vector Index Metrics */}
      <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
        <div className="grid grid-cols-3 gap-2 text-xs tabular-nums">
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Chunks</div>
            <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
              {vectorStats.totalChunks}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Vectors</div>
            <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
              {vectorStats.totalVectors}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Dims</div>
            <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
              {vectorStats.embeddingDims || '—'}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
