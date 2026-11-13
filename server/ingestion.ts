import path from 'path';
import * as XLSX from 'xlsx';
import type {
  IngestedArtifact,
  ModalityType,
  TabularColumnMeta,
  TabularMeta,
} from '../src/types/omniagent.ts';

export interface ParsedChunk {
  chunkId: string;
  artifactId: string;
  artifactName: string;
  modality: ModalityType;
  text: string;
  lineRange?: string;
}

export interface InternalArtifactRecord extends IngestedArtifact {
  rawBuffer?: Buffer;
  inlineBase64?: string;
  fullTextContent?: string;
  chunks: ParsedChunk[];
}

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB per artifact

const CODE_EXTENSIONS = new Set([
  '.py',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.cpp',
  '.cc',
  '.c',
  '.h',
  '.hpp',
  '.go',
  '.rs',
  '.java',
  '.rb',
  '.php',
  '.sql',
  '.sh',
  '.bash',
  '.yaml',
  '.yml',
  '.json',
  '.toml',
  '.xml',
  '.html',
  '.css',
  '.env',
]);

const DOC_TEXT_EXTENSIONS = new Set(['.md', '.mdx', '.txt', '.log', '.rst']);
const TABULAR_EXTENSIONS = new Set(['.csv', '.tsv', '.xlsx', '.xls']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.webm']);

export function detectModality(fileName: string, mimeType: string): ModalityType | null {
  const ext = path.extname(fileName).toLowerCase();
  if (CODE_EXTENSIONS.has(ext)) return 'code';
  if (ext === '.pdf' || DOC_TEXT_EXTENSIONS.has(ext) || mimeType === 'application/pdf') {
    return 'document';
  }
  if (TABULAR_EXTENSIONS.has(ext) || mimeType.includes('spreadsheet') || mimeType === 'text/csv') {
    return 'tabular';
  }
  if (IMAGE_EXTENSIONS.has(ext) || mimeType.startsWith('image/')) {
    return 'image';
  }
  if (AUDIO_EXTENSIONS.has(ext) || mimeType.startsWith('audio/')) {
    return 'audio';
  }
  if (mimeType.startsWith('text/')) {
    return 'document';
  }
  return null;
}

function resolveSafeMimeType(fileName: string, providedMime: string, modality: ModalityType): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.mp3') return 'audio/mpeg';
  if (ext === '.wav') return 'audio/wav';
  if (ext === '.ogg') return 'audio/ogg';
  if (ext === '.m4a') return 'audio/mp4';
  if (ext === '.webm') return 'audio/webm';
  if (ext === '.csv') return 'text/csv';
  if (modality === 'code' || modality === 'document') return 'text/plain';
  return providedMime || 'application/octet-stream';
}

function inferColumnType(values: unknown[]): TabularColumnMeta['inferredType'] {
  const nonEmpty = values.filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
  if (nonEmpty.length === 0) return 'string';
  let numCount = 0;
  let boolCount = 0;
  let dateCount = 0;

  for (const val of nonEmpty) {
    const str = String(val).trim();
    if (typeof val === 'number' || (!Number.isNaN(Number(str)) && str !== '')) {
      numCount++;
    } else if (str.toLowerCase() === 'true' || str.toLowerCase() === 'false') {
      boolCount++;
    } else if (/^\d{4}-\d{2}-\d{2}/.test(str) && !Number.isNaN(Date.parse(str))) {
      dateCount++;
    }
  }

  if (numCount === nonEmpty.length) return 'number';
  if (boolCount === nonEmpty.length) return 'boolean';
  if (dateCount === nonEmpty.length) return 'date';
  if (numCount > 0 && numCount < nonEmpty.length) return 'mixed';
  return 'string';
}

function parseTabularBuffer(
  buffer: Buffer,
  fileName: string
): { tabularMeta: TabularMeta; markdownTable: string } {
  const ext = path.extname(fileName).toLowerCase();
  let workbook: XLSX.WorkBook;

  if (ext === '.csv' || ext === '.tsv') {
    const text = buffer.toString('utf8');
    if (!text.trim()) {
      throw new Error('Spreadsheet file is empty or contains only whitespace.');
    }
    workbook = XLSX.read(text, {
      type: 'string',
      FS: ext === '.tsv' ? '\t' : ',',
    });
  } else {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Workbook contains no readable worksheets.');
  }

  const activeSheet = workbook.SheetNames[0];
  const sheet = workbook.Sheets[activeSheet];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

  if (rows.length === 0) {
    throw new Error(`Worksheet "${activeSheet}" has no data rows.`);
  }

  const colNames = Object.keys(rows[0]);
  const columns: TabularColumnMeta[] = colNames.map((col) => {
    const values = rows.map((r) => r[col]);
    const nullCount = values.filter((v) => v === null || v === undefined || String(v).trim() === '').length;
    const sampleValues = values
      .filter((v) => v !== null && v !== undefined && String(v).trim() !== '')
      .slice(0, 3)
      .map((v) => String(v));
    return {
      name: col,
      inferredType: inferColumnType(values),
      nullCount,
      sampleValues,
    };
  });

  const previewRows = rows.slice(0, 12).map((row) => {
    const clean: Record<string, string | number | boolean | null> = {};
    for (const key of colNames) {
      const val = row[key];
      if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean' || val === null) {
        clean[key] = val;
      } else {
        clean[key] = val === undefined ? null : String(val);
      }
    }
    return clean;
  });

  // Render full markdown representation (capped safely at 250 rows for embedding/context)
  const lines: string[] = [];
  lines.push(`# Tabular Schema: ${fileName} (Sheet: ${activeSheet}, Rows: ${rows.length}, Columns: ${colNames.length})`);
  lines.push(
    columns
      .map((c) => `- ${c.name} (${c.inferredType}, nulls=${c.nullCount})`)
      .join('\n')
  );
  lines.push('');
  lines.push(`| ${colNames.join(' | ')} |`);
  lines.push(`| ${colNames.map(() => '---').join(' | ')} |`);
  for (const row of rows.slice(0, 250)) {
    lines.push(
      `| ${colNames
        .map((c) => String(row[c] ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' '))
        .join(' | ')} |`
    );
  }
  if (rows.length > 250) {
    lines.push(`... (${rows.length - 250} additional rows truncated from markdown preview)`);
  }

  return {
    tabularMeta: {
      sheetNames: workbook.SheetNames,
      activeSheet,
      rowCount: rows.length,
      columnCount: colNames.length,
      columns,
      previewRows,
    },
    markdownTable: lines.join('\n'),
  };
}

export function chunkTextWithLines(
  artifactId: string,
  artifactName: string,
  modality: ModalityType,
  content: string,
  maxChars = 1100
): ParsedChunk[] {
  const lines = content.split(/\r?\n/);
  const chunks: ParsedChunk[] = [];
  let currentLines: string[] = [];
  let startLine = 1;
  let currentLen = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const formattedLine = `${lineNum}: ${lines[i]}`;
    if (currentLen + formattedLine.length > maxChars && currentLines.length > 0) {
      chunks.push({
        chunkId: `${artifactId}_c${chunks.length}`,
        artifactId,
        artifactName,
        modality,
        text: currentLines.join('\n'),
        lineRange: `L${startLine}-L${lineNum - 1}`,
      });
      // Keep 2 lines overlap for continuity
      const overlapCount = Math.min(2, currentLines.length);
      currentLines = currentLines.slice(-overlapCount);
      startLine = Math.max(1, lineNum - overlapCount);
      currentLen = currentLines.reduce((acc, l) => acc + l.length + 1, 0);
    }
    currentLines.push(formattedLine);
    currentLen += formattedLine.length + 1;
  }

  if (currentLines.length > 0) {
    chunks.push({
      chunkId: `${artifactId}_c${chunks.length}`,
      artifactId,
      artifactName,
      modality,
      text: currentLines.join('\n'),
      lineRange: `L${startLine}-L${lines.length}`,
    });
  }

  return chunks;
}

function validateBinaryMagicBytes(buffer: Buffer, ext: string): string | null {
  if (ext === '.pdf') {
    const header = buffer.subarray(0, 5).toString('ascii');
    if (header !== '%PDF-') {
      return 'Corrupt or invalid PDF file: missing %PDF- signature header.';
    }
  }
  if (ext === '.png') {
    const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    if (buffer.length < 8 || !buffer.subarray(0, 4).equals(pngSig)) {
      return 'Corrupt or invalid PNG image: signature mismatch.';
    }
  }
  if (ext === '.jpg' || ext === '.jpeg') {
    if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
      return 'Corrupt or invalid JPEG image: SOI marker mismatch.';
    }
  }
  return null;
}

export function ingestUploadedFile(
  artifactId: string,
  fileName: string,
  providedMimeType: string,
  buffer: Buffer
): InternalArtifactRecord {
  const createdAt = new Date().toISOString();
  const ext = path.extname(fileName).toLowerCase();

  if (!buffer || buffer.length === 0) {
    return {
      id: artifactId,
      name: fileName,
      mimeType: providedMimeType || 'application/octet-stream',
      sizeBytes: 0,
      modality: detectModality(fileName, providedMimeType) ?? 'document',
      status: 'error',
      errorMessage: 'Empty (0-byte) file rejected by ingestion sandbox.',
      chunkCount: 0,
      embeddingModel: 'gemini-embedding-2',
      embeddingDims: 0,
      createdAt,
      chunks: [],
    };
  }

  if (buffer.length > MAX_FILE_BYTES) {
    return {
      id: artifactId,
      name: fileName,
      mimeType: providedMimeType || 'application/octet-stream',
      sizeBytes: buffer.length,
      modality: detectModality(fileName, providedMimeType) ?? 'document',
      status: 'error',
      errorMessage: `File exceeds 20 MB sandbox limit (${(buffer.length / (1024 * 1024)).toFixed(1)} MB).`,
      chunkCount: 0,
      embeddingModel: 'gemini-embedding-2',
      embeddingDims: 0,
      createdAt,
      chunks: [],
    };
  }

  const modality = detectModality(fileName, providedMimeType);
  if (!modality) {
    return {
      id: artifactId,
      name: fileName,
      mimeType: providedMimeType || 'application/octet-stream',
      sizeBytes: buffer.length,
      modality: 'document',
      status: 'error',
      errorMessage: `Unsupported file format "${ext || providedMimeType}". Supported: Code (.py, .js, .ts, .cpp, .sql), Docs (.pdf, .md, .txt), Tabular (.csv, .xlsx), Images (.png, .jpg, .webp), Audio (.mp3, .wav, .m4a).`,
      chunkCount: 0,
      embeddingModel: 'gemini-embedding-2',
      embeddingDims: 0,
      createdAt,
      chunks: [],
    };
  }

  const safeMime = resolveSafeMimeType(fileName, providedMimeType, modality);
  const magicError = validateBinaryMagicBytes(buffer, ext);
  if (magicError) {
    return {
      id: artifactId,
      name: fileName,
      mimeType: safeMime,
      sizeBytes: buffer.length,
      modality,
      status: 'error',
      errorMessage: magicError,
      chunkCount: 0,
      embeddingModel: 'gemini-embedding-2',
      embeddingDims: 0,
      createdAt,
      chunks: [],
    };
  }

  try {
    if (modality === 'tabular') {
      const { tabularMeta, markdownTable } = parseTabularBuffer(buffer, fileName);
      const chunks = chunkTextWithLines(artifactId, fileName, modality, markdownTable, 1200);
      return {
        id: artifactId,
        name: fileName,
        mimeType: safeMime,
        sizeBytes: buffer.length,
        modality,
        status: 'indexed',
        chunkCount: chunks.length,
        embeddingModel: 'gemini-embedding-2',
        embeddingDims: 0,
        textPreview: markdownTable.slice(0, 1200),
        tabularMeta,
        fullTextContent: markdownTable,
        chunks,
        createdAt,
      };
    }

    if (modality === 'image' || modality === 'audio' || ext === '.pdf') {
      const inlineBase64 = buffer.toString('base64');
      const descriptorText = `Multimodal artifact "${fileName}" (${safeMime}, ${(buffer.length / 1024).toFixed(1)} KB). Processed natively via Gemini multimodal context and gemini-embedding-2 vector indexing.`;
      const chunks: ParsedChunk[] = [
        {
          chunkId: `${artifactId}_c0`,
          artifactId,
          artifactName: fileName,
          modality,
          text: descriptorText,
          lineRange: modality === 'image' ? 'Visual Frame' : modality === 'audio' ? 'Audio Stream' : 'PDF Document',
        },
      ];
      return {
        id: artifactId,
        name: fileName,
        mimeType: safeMime,
        sizeBytes: buffer.length,
        modality,
        status: 'indexed',
        chunkCount: chunks.length,
        embeddingModel: 'gemini-embedding-2',
        embeddingDims: 0,
        textPreview: descriptorText,
        imageDataUrl: modality === 'image' ? `data:${safeMime};base64,${inlineBase64}` : undefined,
        inlineBase64,
        rawBuffer: buffer,
        fullTextContent: descriptorText,
        chunks,
        createdAt,
      };
    }

    // Text / Code / Markdown
    // Guard against disguised binary files
    if (buffer.includes(0x00)) {
      return {
        id: artifactId,
        name: fileName,
        mimeType: safeMime,
        sizeBytes: buffer.length,
        modality,
        status: 'error',
        errorMessage: 'Corrupt or binary null-byte sequence detected inside text/code artifact.',
        chunkCount: 0,
        embeddingModel: 'gemini-embedding-2',
        embeddingDims: 0,
        createdAt,
        chunks: [],
      };
    }

    const decoded = buffer.toString('utf8');
    const chunks = chunkTextWithLines(artifactId, fileName, modality, decoded, 1100);
    return {
      id: artifactId,
      name: fileName,
      mimeType: safeMime,
      sizeBytes: buffer.length,
      modality,
      status: 'indexed',
      chunkCount: chunks.length,
      embeddingModel: 'gemini-embedding-2',
      embeddingDims: 0,
      textPreview: decoded.slice(0, 1800),
      fullTextContent: decoded,
      chunks,
      createdAt,
    };
  } catch (err) {
    return {
      id: artifactId,
      name: fileName,
      mimeType: safeMime,
      sizeBytes: buffer.length,
      modality,
      status: 'error',
      errorMessage: err instanceof Error ? err.message : 'Failed to parse file inside ingestion sandbox.',
      chunkCount: 0,
      embeddingModel: 'gemini-embedding-2',
      embeddingDims: 0,
      createdAt,
      chunks: [],
    };
  }
}
