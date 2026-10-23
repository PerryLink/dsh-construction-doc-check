/**
 * Directory-level completeness checks for construction documents.
 *
 * L0 means filename-only: no document is opened, no cell is parsed. That is a
 * deliberate ceiling, not a shortcut — a real project archive holds a thousand
 * files, and asking a 资料员 to first transcribe them into a table and then run a
 * check gives him more work, not less. The directory and the file names are what
 * he already has.
 *
 * Two claims this engine refuses to make:
 *
 *  - "A file of this kind exists" is not "this document is correct". Content is
 *    L1/L2's job.
 *  - "No file of this kind exists" is not "the work was not done". It says the
 *    archive cannot prove it, which is a different sentence.
 */

import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { parseYaml } from './shared/yaml.ts'

/** One requirement from the pack. */
export interface Requirement {
  id: string
  title: string
  category: string
  severity: 'error' | 'warn' | 'info'
  patterns: string[]
  note: string
  basis: {
    document: string
    number: string
    clause: string
    excerpt: string
    kind: string
    source: string
  }
}

/** Scan parameters. */
export interface ScanOptions {
  maxDepth: number
  skipDirs: string[]
  emptyFileBytes: number
}

/** A loaded pack. */
export interface ConstructionPack {
  version: string
  scan: ScanOptions
  rules: Requirement[]
}

/** One file found on disk. */
export interface ScannedFile {
  /** Path relative to the scanned root. */
  path: string
  /** File name without directories. */
  name: string
  bytes: number
}

/** One finding. */
export interface ConstructionFinding {
  ruleId: string
  severity: 'error' | 'warn' | 'info'
  category: string
  title: string
  message: string
  /** Files that matched, for a "present" finding; empty for a missing one. */
  evidence: string[]
  basis: string
}

/** The whole result. */
export interface ConstructionResult {
  root: string
  files: ScannedFile[]
  findings: ConstructionFinding[]
  summary: { present: number; missing: number; errors: number; warnings: number; infos: number; dirsScanned: number }
  warnings: string[]
}

/** Raised when the pack or the directory cannot be used. */
export class ConstructionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConstructionError'
  }
}

/**
 * Load the requirement pack.
 *
 * @param yaml - the pack file's text.
 * @returns the pack.
 * @throws ConstructionError when the pack is malformed.
 */
export function loadPack(yaml: string): ConstructionPack {
  const parsed = parseYaml(yaml) as Record<string, unknown> | undefined
  if (parsed === undefined || parsed === null || typeof parsed !== 'object') {
    throw new ConstructionError('规则库不是映射')
  }
  const scanRaw = (parsed.scan ?? {}) as Record<string, unknown>
  const scan: ScanOptions = {
    maxDepth: typeof scanRaw.maxDepth === 'number' ? scanRaw.maxDepth : 6,
    skipDirs: Array.isArray(scanRaw.skipDirs) ? scanRaw.skipDirs.map(String) : [],
    emptyFileBytes: typeof scanRaw.emptyFileBytes === 'number' ? scanRaw.emptyFileBytes : 0,
  }
  const rawRules = Array.isArray(parsed.rules) ? parsed.rules : []
  if (rawRules.length === 0) throw new ConstructionError('规则库没有任何规则')
  const rules = rawRules.map((raw) => {
    const entry = raw as Record<string, unknown>
    const id = String(entry.id ?? '')
    if (id === '') throw new ConstructionError('有规则缺少 id')
    const basisRaw = (entry.basis ?? {}) as Record<string, unknown>
    const severity = String(entry.severity ?? 'warn')
    if (severity !== 'error' && severity !== 'warn' && severity !== 'info') {
      throw new ConstructionError(`规则 ${id} 的 severity「${severity}」不受支持`)
    }
    const level = severity as 'error' | 'warn' | 'info'
    const patterns = Array.isArray(entry.patterns) ? entry.patterns.map(String) : []
    for (const pattern of patterns) {
      try {
        new RegExp(pattern, 'u')
      } catch {
        throw new ConstructionError(`规则 ${id} 的模式「${pattern}」不是合法正则`)
      }
    }
    return {
      id,
      title: String(entry.title ?? ''),
      category: String(entry.category ?? ''),
      severity: level,
      patterns,
      note: String(entry.note ?? ''),
      basis: {
        document: String(basisRaw.document ?? ''),
        number: String(basisRaw.number ?? ''),
        clause: String(basisRaw.clause ?? ''),
        excerpt: String(basisRaw.excerpt ?? ''),
        kind: String(basisRaw.kind ?? ''),
        source: String(basisRaw.source ?? ''),
      },
    }
  })
  return { version: String(parsed.version ?? ''), scan, rules }
}

/**
 * Walk a directory, collecting files up to the depth limit.
 *
 * @param root - the project folder.
 * @param options - scan parameters.
 * @returns every file found, relative to `root`.
 */
export async function scan(root: string, options: ScanOptions): Promise<{ files: ScannedFile[]; dirs: number; warnings: string[] }> {
  const files: ScannedFile[] = []
  const warnings: string[] = []
  let dirs = 0

  const walk = async (directory: string, prefix: string, depth: number): Promise<void> => {
    if (depth > options.maxDepth) {
      warnings.push(`超过深度 ${options.maxDepth}，未继续扫描：${prefix || '.'}`)
      return
    }
    let entries
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch (error) {
      warnings.push(`无法读取目录 ${prefix || '.'}：${error instanceof Error ? error.message : String(error)}`)
      return
    }
    dirs++
    for (const entry of entries) {
      const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`
      if (entry.isDirectory()) {
        if (options.skipDirs.includes(entry.name)) continue
        await walk(join(directory, entry.name), relative, depth + 1)
        continue
      }
      if (!entry.isFile()) continue
      try {
        const info = await stat(join(directory, entry.name))
        files.push({ path: relative, name: entry.name, bytes: info.size })
      } catch {
        warnings.push(`无法读取文件大小：${relative}`)
        files.push({ path: relative, name: entry.name, bytes: -1 })
      }
    }
  }

  await walk(root, '', 0)
  return { files, dirs, warnings }
}

/** Build the citation line for a requirement. */
function basisOf(rule: Requirement): string {
  return `《${rule.basis.document}》${rule.basis.number} ${rule.basis.clause}：${rule.basis.excerpt}`
}

/** Revision markers that suggest a stale copy sitting next to the current one. */
const REVISION_MARKERS = /[(（]\s*\d+\s*[)）]|副本|最终|最新|修订|修改|旧版|V\d+|v\d+/u

/** Strip a revision marker so two copies of one document share a base name. */
function baseNameOf(name: string): string {
  return name
    .replace(/\.[^.]+$/u, '')
    .replace(REVISION_MARKERS, '')
    .replace(/[\s\-_—]+$/u, '')
    .trim()
}

/**
 * Run the pack over a scanned directory.
 *
 * @param pack - the loaded pack.
 * @param root - the scanned root, for the report header.
 * @param files - files found by {@link scan}.
 * @param dirs - number of directories scanned.
 * @returns findings and counters.
 */
export function check(pack: ConstructionPack, root: string, files: ScannedFile[], dirs: number): ConstructionResult {
  const findings: ConstructionFinding[] = []
  const warnings: string[] = []
  let present = 0
  let missing = 0

  for (const rule of pack.rules) {
    // Two rules are about the set of files rather than a kind of document.
    if (rule.id === 'CD-040') {
      const groups = new Map<string, ScannedFile[]>()
      for (const file of files) {
        const base = baseNameOf(file.name)
        if (base === '') continue
        const bucket = groups.get(base)
        if (bucket === undefined) groups.set(base, [file])
        else bucket.push(file)
      }
      for (const [base, bucket] of groups) {
        if (bucket.length < 2) continue
        findings.push({
          ruleId: rule.id,
          severity: rule.severity,
          category: rule.category,
          title: rule.title,
          message: `「${base}」在归档中有 ${bucket.length} 份，可能残留旧版本`,
          evidence: bucket.map((file) => file.path),
          basis: basisOf(rule),
        })
      }
      continue
    }
    if (rule.id === 'CD-041') {
      for (const file of files) {
        if (file.bytes > pack.scan.emptyFileBytes) continue
        findings.push({
          ruleId: rule.id,
          severity: rule.severity,
          category: rule.category,
          title: rule.title,
          message: `「${file.path}」是零字节文件`,
          evidence: [file.path],
          basis: basisOf(rule),
        })
      }
      continue
    }

    if (rule.patterns.length === 0) continue
    const regexes = rule.patterns.map((pattern) => new RegExp(pattern, 'u'))
    // Match the relative path, not just the file name: real archives classify by
    // folder (`危大工程/模板工程验收记录.docx`), so requiring the keyword in the
    // file name alone would report a document that is plainly there as missing.
    const matched = files.filter((file) => regexes.some((regex) => regex.test(file.path)))
    if (matched.length > 0) {
      present++
      continue
    }
    missing++
    findings.push({
      ruleId: rule.id,
      severity: rule.severity,
      category: rule.category,
      title: rule.title,
      message: `归档中没有找到「${rule.title}」这一类文件（按目录与文件名匹配：${rule.patterns.join(' 或 ')}）`,
      evidence: [],
      basis: basisOf(rule),
    })
  }

  if (files.length === 0) warnings.push(`目录「${root}」下没有扫描到任何文件；确认路径是否是资料归档目录`)

  return {
    root,
    files,
    findings,
    summary: {
      present,
      missing,
      errors: findings.filter((item) => item.severity === 'error').length,
      warnings: findings.filter((item) => item.severity === 'warn').length,
      infos: findings.filter((item) => item.severity === 'info').length,
      dirsScanned: dirs,
    },
    warnings,
  }
}
