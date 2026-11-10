/**
 * Adapter: public document manifest -> a temporary project directory.
 *
 * The adapter deliberately does NOT rename public UFGS specification sections
 * into Chinese compliance forms. A guide specification is not a filled
 * 竣工验收记录, 监理日志, 检验批 record, or 专项施工方案, and renaming one would
 * manufacture a false-positive corpus. No semantic mapping is available for the
 * Chinese rule pack's document-type rules, so every document keeps its upstream
 * filename. The only rule pack this bench can legitimately exercise for
 * presence is a bench-generated exact-filename pack (see evaluate.mjs).
 *
 * The zero-byte and stale-copy scenarios are generic file-system checks, so they
 * are run with the shipped Chinese rule pack (CD-041 / CD-040) unchanged.
 */
import { createHash } from 'node:crypto'
import { copyFile, mkdir, mkdtemp, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
export const BENCH_DIR = here
export const DATA_DIR = join(here, '.data')
export const TMP_DIR = join(here, '.tmp')
export const SOURCES_PATH = join(here, 'sources.json')

/**
 * Every document-type rule in rules/construction-doc-check.yaml, with an
 * explicit verdict. There is no mapping; the candidate column records the
 * nearest UFGS document and why it is not equivalent. A human adding a mapping
 * must replace the verdict and say why the semantics hold.
 */
export const SEMANTIC_MAPPING = [
  {
    ruleId: 'CD-001',
    requirement: '竣工验收记录应齐全（四张表）',
    candidate: 'UFGS 01 78 00 Closeout Submittals',
    mappedTo: null,
    verdict: 'not-equivalent',
    reason: 'A guide specification for closeout submittals is not a filled 单位工程质量竣工验收记录 (or the other three acceptance tables).',
  },
  {
    ruleId: 'CD-002',
    requirement: '应有工程竣工报告',
    candidate: null,
    mappedTo: null,
    verdict: 'no-public-match',
    reason: 'No public UFGS section is a project completion report.',
  },
  {
    ruleId: 'CD-003',
    requirement: '应有工程质量保修书',
    candidate: 'UFGS 01 78 00 Closeout Submittals',
    mappedTo: null,
    verdict: 'not-equivalent',
    reason: '01 78 00 specifies warranty submittal requirements; it is not the executed 工程质量保修书.',
  },
  {
    ruleId: 'CD-010',
    requirement: '应有检验批质量验收记录',
    candidate: null,
    mappedTo: null,
    verdict: 'no-public-match',
    reason: 'No public UFGS section is a filled inspection-lot acceptance record.',
  },
  {
    ruleId: 'CD-011',
    requirement: '应有隐蔽工程验收记录',
    candidate: null,
    mappedTo: null,
    verdict: 'no-public-match',
    reason: 'No public UFGS section is a concealed-work acceptance record.',
  },
  {
    ruleId: 'CD-012',
    requirement: '应有分部工程质量验收记录',
    candidate: null,
    mappedTo: null,
    verdict: 'no-public-match',
    reason: 'No public UFGS section is a divisional completion acceptance record.',
  },
  {
    ruleId: 'CD-013',
    requirement: '应有材料进场复试报告',
    candidate: null,
    mappedTo: null,
    verdict: 'no-public-match',
    reason: 'No public UFGS section is a material re-test report.',
  },
  {
    ruleId: 'CD-014',
    requirement: '应有监理日志',
    candidate: 'UFGS 01 45 00 Quality Control',
    mappedTo: null,
    verdict: 'not-equivalent',
    reason: '01 45 00 is a quality-control specification, not a daily supervision log.',
  },
  {
    ruleId: 'CD-015',
    requirement: '应有施工日志',
    candidate: null,
    mappedTo: null,
    verdict: 'no-public-match',
    reason: 'No public UFGS section is a daily construction log.',
  },
  {
    ruleId: 'CD-020',
    requirement: '危大工程应有专项施工方案',
    candidate: 'UFGS 01 35 26 Government Safety and Health Requirements',
    mappedTo: null,
    verdict: 'not-equivalent',
    reason: '01 35 26 is a guide specification for safety and health requirements, not a project-specific approved 危大工程专项施工方案.',
  },
  {
    ruleId: 'CD-021',
    requirement: '危大工程应有验收记录',
    candidate: null,
    mappedTo: null,
    verdict: 'no-public-match',
    reason: 'No public UFGS section is a filled acceptance record for a hazardous sub-project.',
  },
  {
    ruleId: 'CD-030',
    requirement: '应有应急预案',
    candidate: 'UFGS 01 35 26 Government Safety and Health Requirements',
    mappedTo: null,
    verdict: 'not-equivalent',
    reason: '01 35 26 references emergency planning; the section itself is not the project emergency response plan.',
  },
]

/** Rule ids that have a semantic mapping. Empty by design. */
export const MAPPED_RULE_IDS = SEMANTIC_MAPPING.filter((item) => item.mappedTo !== null).map((item) => item.ruleId)

/** Generic rules that do not depend on Chinese document types. */
export const GENERIC_RULE_IDS = ['CD-040', 'CD-041', 'CD-042']

/** @returns {Promise<any>} */
export async function loadSources() {
  return JSON.parse(await readFile(SOURCES_PATH, 'utf8'))
}

/** @param {Buffer|string} bytes */
export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

/**
 * Verify every pinned PDF without touching the network.
 *
 * @param {any} sources
 * @returns {Promise<{ok: boolean, checked: Array<{filename: string, ok: boolean, reason?: string}>}>}
 */
export async function verifyData(sources) {
  const checked = []
  for (const doc of sources.documents) {
    let info
    try {
      info = await stat(join(DATA_DIR, doc.filename))
    } catch {
      checked.push({ filename: doc.filename, ok: false, reason: 'missing; run `node bench/public-construction/fetch.mjs`' })
      continue
    }
    if (!info.isFile()) {
      checked.push({ filename: doc.filename, ok: false, reason: 'not a regular file' })
      continue
    }
    if (info.size !== doc.bytes) {
      checked.push({ filename: doc.filename, ok: false, reason: `size ${info.size} != pinned ${doc.bytes}` })
      continue
    }
    const bytes = await readFile(join(DATA_DIR, doc.filename))
    if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') {
      checked.push({ filename: doc.filename, ok: false, reason: 'missing %PDF- header' })
      continue
    }
    const digest = sha256(bytes)
    if (digest !== doc.sha256) {
      checked.push({ filename: doc.filename, ok: false, reason: `sha256 ${digest} != pinned ${doc.sha256}` })
      continue
    }
    checked.push({ filename: doc.filename, ok: true })
  }
  return { ok: checked.every((item) => item.ok), checked }
}

/** Create one isolated temp run directory under bench/public-construction/.tmp. */
export async function createRunRoot() {
  await mkdir(TMP_DIR, { recursive: true })
  return mkdtemp(join(TMP_DIR, 'run-'))
}

/** @param {string} path */
function assertInside(path, root) {
  const target = resolve(path)
  const base = resolve(root)
  if (target !== base && !target.startsWith(base + sep)) {
    throw new Error(`refusing to touch ${target}: outside ${base}`)
  }
  return target
}

/**
 * Copy the requested public documents into `<runRoot>/<caseId>/archive`.
 *
 * @param {{
 *   runRoot: string,
 *   caseId: string,
 *   documents: any[],
 *   layout?: 'flat'|'nested',
 * }} options
 */
export async function materializeProject({ runRoot, caseId, documents, layout = 'flat' }) {
  if (layout !== 'flat' && layout !== 'nested') throw new Error(`unsupported layout: ${layout}`)
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(caseId)) throw new Error(`unsafe case id: ${caseId}`)
  const realRunRoot = assertInside(runRoot, TMP_DIR)
  const archive = join(realRunRoot, caseId, 'archive')
  await mkdir(archive, { recursive: true })

  const files = []
  for (const doc of documents) {
    if (basename(doc.filename) !== doc.filename || doc.filename.startsWith('.')) {
      throw new Error(`unsafe source filename: ${JSON.stringify(doc.filename)}`)
    }
    if (layout === 'nested' && !/^[a-z0-9][a-z0-9-]*$/u.test(doc.sectionGroup)) {
      throw new Error(`unsafe sectionGroup: ${JSON.stringify(doc.sectionGroup)}`)
    }
    const directory = layout === 'nested' ? join(archive, doc.sectionGroup) : archive
    assertInside(directory, archive)
    await mkdir(directory, { recursive: true })
    const destination = join(directory, doc.filename)
    assertInside(destination, archive)
    await copyFile(join(DATA_DIR, doc.filename), destination)
    files.push({
      docId: doc.id,
      path: relative(archive, destination).split(sep).join('/'),
      absolute: destination,
    })
  }
  return { dir: archive, root: join(realRunRoot, caseId), files }
}

/** @param {{dir: string, files: any[]}} project @param {string} docId */
function fileOf(project, docId) {
  const file = project.files.find((item) => item.docId === docId)
  if (file === undefined) throw new Error(`document not in project: ${docId}`)
  return file.absolute
}

/** Delete one document from a temp project. */
export async function removeDocument(project, docId) {
  const file = assertInside(fileOf(project, docId), project.dir)
  await unlink(file)
}

/** Truncate one document to zero bytes in a temp project. */
export async function zeroDocument(project, docId) {
  const file = assertInside(fileOf(project, docId), project.dir)
  await writeFile(file, Buffer.alloc(0))
}

/**
 * Place a byte-identical copy next to the original under a revision-marked name.
 *
 * @returns {Promise<{path: string, base: string}>} relative path and the base
 *   name a human would consider "the same document".
 */
export async function duplicateDocument(project, docId, alias) {
  if (basename(alias) !== alias || alias.startsWith('.')) throw new Error(`unsafe alias: ${JSON.stringify(alias)}`)
  const original = assertInside(fileOf(project, docId), project.dir)
  const destination = assertInside(join(dirname(original), alias), project.dir)
  await copyFile(original, destination)
  const stem = basename(original, '.pdf')
  return { path: relative(project.dir, destination).split(sep).join('/'), base: stem }
}

/**
 * Build an anchored regex for an exact public filename, allowing any folder.
 * The engine matches relative paths, so nested layouts need the `(?:^|/)` prefix.
 */
export function exactFilenamePattern(filename) {
  return `(?:^|/)${filename.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}$`
}

/** Path of a document inside an archive, for labels and observations. */
export function projectPathOf(doc, layout) {
  return layout === 'nested' ? `${doc.sectionGroup}/${doc.filename}` : doc.filename
}
