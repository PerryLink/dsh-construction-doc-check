#!/usr/bin/env node
/**
 * Reproducible downloader for the public-construction benchmark corpus.
 *
 * Source: six U.S. UFGS specification sections published by WBDG. The URLs and
 * expected SHA-256 digests are pinned in sources.json. Upstream files can be
 * replaced, so a changed digest is a hard failure: the benchmark would otherwise
 * silently measure a different corpus.
 *
 * Usage:
 *   node bench/public-construction/fetch.mjs           download missing files
 *   node bench/public-construction/fetch.mjs --force   re-download everything
 *   node bench/public-construction/fetch.mjs --check   verify only, no network
 *
 * Downloads land in bench/public-construction/.data/ (gitignored).
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, '.data')
const sourcesPath = join(here, 'sources.json')
const manifestPath = join(dataDir, 'fetch-manifest.json')
const userAgent = 'dsh-construction-doc-check-bench/1.0 (+https://github.com/PerryLink/dsh-construction-doc-check)'

const args = new Set(process.argv.slice(2))
if (args.has('--help') || args.has('-h')) {
  console.log('usage: node bench/public-construction/fetch.mjs [--force|--check]')
  process.exit(0)
}
const force = args.has('--force')
const checkOnly = args.has('--check')

/** @param {Buffer|string} bytes */
function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

/**
 * @param {string} file
 * @param {any} doc
 */
async function verifyFile(file, doc) {
  let info
  try {
    info = await stat(file)
  } catch {
    return { ok: false, exists: false, reason: 'missing' }
  }
  if (!info.isFile()) return { ok: false, exists: false, reason: 'not a regular file' }
  if (info.size !== doc.bytes) {
    return { ok: false, exists: true, reason: `size ${info.size} != pinned ${doc.bytes}` }
  }
  const bytes = await readFile(file)
  if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') {
    return { ok: false, exists: true, reason: 'not a PDF (missing %PDF- header)' }
  }
  const digest = sha256(bytes)
  if (digest !== doc.sha256) {
    return { ok: false, exists: true, reason: `sha256 ${digest} != pinned ${doc.sha256}` }
  }
  return { ok: true, exists: true, bytes: bytes.length, sha256: digest }
}

/**
 * @param {any} doc
 * @param {boolean} forceDownload
 */
async function fetchOne(doc, forceDownload) {
  const destination = join(dataDir, doc.filename)
  if (!forceDownload) {
    const cached = await verifyFile(destination, doc)
    if (cached.ok) return { doc, status: 'cached', ...cached }
    if (cached.exists) {
      throw new Error(
        `${doc.filename}: ${cached.reason}. Refusing to benchmark an unpinned file. ` +
          `Re-run with --force only after checking that the upstream document is still the one you want.`,
      )
    }
  }
  if (checkOnly) throw new Error(`${doc.filename}: missing (--check does not download)`)

  const response = await fetch(doc.url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(120_000),
    headers: { 'user-agent': userAgent, accept: 'application/pdf' },
  })
  if (!response.ok) throw new Error(`${doc.filename}: HTTP ${response.status} ${response.statusText} from ${doc.url}`)
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/pdf')) {
    throw new Error(`${doc.filename}: unexpected content-type "${contentType}" from ${doc.url}`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw new Error(`${doc.filename}: downloaded body does not start with %PDF-`)
  }
  if (buffer.length !== doc.bytes) {
    throw new Error(`${doc.filename}: downloaded ${buffer.length} bytes, pinned ${doc.bytes}`)
  }
  const digest = sha256(buffer)
  if (digest !== doc.sha256) {
    throw new Error(`${doc.filename}: downloaded sha256 ${digest}, pinned ${doc.sha256}`)
  }
  const temporary = `${destination}.part`
  await writeFile(temporary, buffer)
  await rename(temporary, destination)
  return { doc, status: 'downloaded', ok: true, exists: true, bytes: buffer.length, sha256: digest }
}

async function main() {
  const sources = JSON.parse(await readFile(sourcesPath, 'utf8'))
  const documents = sources.documents
  if (!Array.isArray(documents) || documents.length === 0) throw new Error('sources.json has no documents')
  await mkdir(dataDir, { recursive: true })

  const results = []
  for (const doc of documents) {
    if (typeof doc.filename !== 'string' || doc.filename.includes('/') || doc.filename.includes('\\')) {
      throw new Error(`unsafe filename in sources.json: ${JSON.stringify(doc.filename)}`)
    }
    const result = await fetchOne(doc, force)
    results.push(result)
    console.log(
      `${result.status.padEnd(10)} ${doc.filename}  ${doc.bytes} bytes  sha256:${doc.sha256.slice(0, 12)}…`,
    )
  }

  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: sources.corpus.title,
        licenseStatus: sources.corpus.license.status,
        documents: results.map(({ doc, status, bytes, sha256: digest }) => ({
          id: doc.id,
          filename: doc.filename,
          url: doc.url,
          sourcePage: doc.sourcePage,
          bytes,
          sha256: digest,
          status,
        })),
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`\nwrote ${resolve(manifestPath)}`)
  console.log(`corpus verified: ${results.length} PDFs, ${results.reduce((sum, item) => sum + item.bytes, 0)} bytes`)
}

main().catch((error) => {
  console.error(`fetch.mjs: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
