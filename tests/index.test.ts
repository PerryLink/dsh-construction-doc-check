/**
 * Directory completeness scan.
 *
 * The properties that matter are about what the report *claims*: a present file is
 * not a correct document, and a missing file is not a missing activity. The tests
 * build throwaway trees so each rule is exercised on the shape it targets.
 */

import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { check, loadPack, scan } from '../src/engine.ts'
import { renderMarkdown } from '../src/report.ts'
import { readFileSync } from 'node:fs'

const PACK = readFileSync(join(import.meta.dirname, '../rules/construction-doc-check.yaml'), 'utf8')
const pack = loadPack(PACK)

let root = ''
let full = ''

/** Write a file with the given relative path and size. */
async function touch(base: string, relative: string, bytes = 10): Promise<void> {
  const full = join(base, relative)
  await mkdir(join(full, '..'), { recursive: true })
  await writeFile(full, 'x'.repeat(bytes))
}

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'dsh-construction-'))
  full = join(root, 'full')
  // A folder that satisfies every rule.
  for (const name of [
    '竣工验收/单位工程质量竣工验收记录.docx',
    '竣工验收/竣工报告.docx',
    '竣工验收/工程质量保修书.docx',
    '施工记录/检验批质量验收记录.xlsx',
    '施工记录/隐蔽工程验收记录.docx',
    '施工记录/主体结构分部工程验收记录.docx',
    '施工记录/施工日志.docx',
    '施工试验/钢筋复试报告.pdf',
    '监理资料/监理日志.pdf',
    '危大工程/模板工程专项施工方案.docx',
    '危大工程/模板工程验收记录.docx',
    '安全管理/生产安全事故应急预案.docx',
  ]) {
    await touch(full, name)
  }
  // An empty folder: every requirement is missing.
  await mkdir(join(root, 'empty'), { recursive: true })
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('scan', () => {
  it('walks nested directories and records sizes', async () => {
    const { files, dirs } = await scan(full, pack.scan)
    expect(files.length).toBe(12)
    expect(dirs).toBeGreaterThan(1)
    expect(files.every((file) => file.bytes > 0)).toBe(true)
  })

  it('skips the directories the pack names', async () => {
    await touch(full, '旧版备份/竣工报告-旧.docx')
    const { files } = await scan(full, pack.scan)
    expect(files.some((file) => file.path.includes('旧版备份'))).toBe(false)
    await rm(join(full, '旧版备份'), { recursive: true, force: true })
  })
})

describe('check', () => {
  it('reports nothing missing for a complete archive', async () => {
    const { files, dirs } = await scan(full, pack.scan)
    const result = check(pack, full, files, dirs)
    expect(result.summary.missing).toBe(0)
    expect(result.findings.filter((item) => item.message.includes('没有找到'))).toHaveLength(0)
  })

  it('reports every requirement as missing for an empty archive', async () => {
    const empty = join(root, 'empty')
    const { files, dirs } = await scan(empty, pack.scan)
    const result = check(pack, empty, files, dirs)
    // Twelve requirement rules carry patterns; the two set-level rules do not.
    const withPatterns = pack.rules.filter((rule) => rule.patterns.length > 0).length
    expect(result.summary.missing).toBe(withPatterns)
    expect(result.warnings.some((warning) => warning.includes('没有扫描到任何文件'))).toBe(true)
  })

  it('names the rule and the patterns it looked for', async () => {
    const empty = join(root, 'empty')
    const { files, dirs } = await scan(empty, pack.scan)
    const result = check(pack, empty, files, dirs)
    const missing = result.findings.find((item) => item.ruleId === 'CD-001')
    expect(missing?.message).toContain('没有找到')
    expect(missing?.message).toContain('竣工验收记录')
    expect(missing?.basis).toContain('GB 50300')
  })

  it('flags a zero-byte file rather than counting it as present', async () => {
    const probe = join(root, 'zero')
    await touch(probe, '竣工验收/竣工报告.docx', 0)
    const { files, dirs } = await scan(probe, pack.scan)
    const result = check(pack, probe, files, dirs)
    expect(result.findings.some((item) => item.ruleId === 'CD-041')).toBe(true)
    // The file still counts as present for CD-002: presence and validity are
    // separate claims, and the report makes both.
    expect(result.findings.some((item) => item.ruleId === 'CD-002')).toBe(false)
  })

  it('flags two revisions of the same document sitting side by side', async () => {
    const probe = join(root, 'rev')
    await touch(probe, '施工记录/施工日志.docx')
    await touch(probe, '施工记录/施工日志(1).docx')
    const { files, dirs } = await scan(probe, pack.scan)
    const result = check(pack, probe, files, dirs)
    const finding = result.findings.find((item) => item.ruleId === 'CD-040')
    expect(finding).toBeDefined()
    expect(finding?.evidence).toHaveLength(2)
  })
})

describe('report', () => {
  it('states the scope before the findings', async () => {
    const empty = join(root, 'empty')
    const { files, dirs } = await scan(empty, pack.scan)
    const result = check(pack, empty, files, dirs)
    const markdown = renderMarkdown(result, pack.version)
    expect(markdown).toContain('本报告能说明什么')
    expect(markdown).toContain('不等于现场没做')
    expect(markdown).toContain('不判断份数')
    expect(markdown.indexOf('本报告能说明什么')).toBeLessThan(markdown.indexOf('缺件清单'))
  })
})
