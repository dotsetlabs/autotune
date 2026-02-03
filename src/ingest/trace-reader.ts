import fs from 'fs';
import path from 'path';
import { AutotuneDb } from '../storage/sqlite.js';
import { normalizeTrace } from './trace-normalizer.js';
import { redactObject } from './redact.js';
import { AutotuneConfig } from '../config.js';

 type OffsetMap = Record<string, number>;

function loadOffsets(db: AutotuneDb): OffsetMap {
  const raw = db.getMeta('ingest_offsets');
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as OffsetMap;
    return parsed || {};
  } catch {
    return {};
  }
}

function saveOffsets(db: AutotuneDb, offsets: OffsetMap): void {
  db.setMeta('ingest_offsets', JSON.stringify(offsets));
}

function listTraceFiles(traceDir: string): string[] {
  if (!fs.existsSync(traceDir)) return [];
  return fs
    .readdirSync(traceDir)
    .filter(name => name.endsWith('.jsonl'))
    .map(name => path.join(traceDir, name));
}

function readNewLines(filePath: string, offset: number): { lines: string[]; newOffset: number } {
  const stat = fs.statSync(filePath);
  let start = offset;
  if (stat.size < offset) {
    start = 0;
  }
  const bytesToRead = stat.size - start;
  if (bytesToRead <= 0) {
    return { lines: [], newOffset: start };
  }
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(bytesToRead);
  fs.readSync(fd, buffer, 0, bytesToRead, start);
  fs.closeSync(fd);

  const text = buffer.toString('utf-8');
  const lastNewline = text.lastIndexOf('\n');
  if (lastNewline === -1) {
    return { lines: [], newOffset: start };
  }

  const completeText = text.slice(0, lastNewline);
  const bytesConsumed = Buffer.byteLength(text.slice(0, lastNewline + 1), 'utf-8');
  const newOffset = start + bytesConsumed;

  const lines = completeText
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  return { lines, newOffset };
}

export function ingestTraces(db: AutotuneDb, config: AutotuneConfig): { ingested: number; files: number } {
  const offsets = loadOffsets(db);
  const files = listTraceFiles(config.traceDir);
  let ingested = 0;

  for (const filePath of files) {
    const offset = offsets[filePath] || 0;
    const { lines, newOffset } = readNewLines(filePath, offset);
    if (lines.length === 0) {
      offsets[filePath] = newOffset;
      continue;
    }

    for (const line of lines) {
      try {
        const raw = JSON.parse(line);
        const normalized = normalizeTrace(raw);
        if (!normalized) continue;
        const trace = config.redact ? (redactObject(normalized) as typeof normalized) : normalized;
        db.insertTrace(trace);
        ingested += 1;
      } catch {
        continue;
      }
    }

    offsets[filePath] = newOffset;
  }

  saveOffsets(db, offsets);
  return { ingested, files: files.length };
}
