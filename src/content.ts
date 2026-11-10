/**
 * Minimal PDF text-layer extraction.
 *
 * This is deliberately a small, dependency-free reader: it inflates FlateDecode
 * streams and extracts the literal strings used by text operators. It is not a
 * full PDF parser and does not position glyphs; its only job is to answer
 * whether a PDF contains a machine-readable text layer at all.
 */
import { inflateSync } from 'node:zlib'

function decodeLiteral(value: string): string {
  return value
    .replace(/\\([()\\])/gu, '$1')
    .replace(/\\n/gu, '\n')
    .replace(/\\r/gu, '\r')
    .replace(/\\t/gu, '\t')
    .replace(/\\([0-7]{1,3})/gu, (_match, oct: string) => String.fromCharCode(Number.parseInt(oct, 8)))
}

/** Extract literal text from a PDF buffer; returns an empty string when none is found. */
export function extractPdfText(buffer: Buffer): string {
  const source = buffer.toString('latin1')
  const stream = /stream\r?\n([\s\S]*?)\r?\nendstream/gu
  let match: RegExpExecArray | null
  const chunks: string[] = []
  while ((match = stream.exec(source)) !== null) {
    let raw: Buffer
    try {
      raw = inflateSync(Buffer.from(match[1] ?? '', 'latin1'))
    } catch {
      raw = Buffer.from(match[1] ?? '', 'latin1')
    }
    const content = raw.toString('latin1')
    const literals = content.match(/\((?:\\.|[^)])*\)/gu) ?? []
    for (const literal of literals) chunks.push(decodeLiteral(literal.slice(1, -1)))
  }
  return chunks.join(' ').replace(/\s+/gu, ' ').trim()
}
