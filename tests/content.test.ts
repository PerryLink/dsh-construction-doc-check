import { describe, expect, it } from 'vitest'
import { extractPdfText } from '../src/content.ts'

function minimalPdf(text: string): Buffer {
  const stream = `BT /F1 12 Tf (${text}) Tj ET`
  return Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n%%EOF\n`, 'latin1')
}

describe('PDF content extraction', () => {
  it('extracts a literal text layer', () => {
    expect(extractPdfText(minimalPdf('construction text layer'))).toContain('construction text layer')
  })

  it('returns an empty string when there is no text layer', () => {
    expect(extractPdfText(Buffer.from('%PDF-1.4\n%%EOF\n', 'latin1'))).toBe('')
  })
})

describe('CD-043 content rule', () => {
  it('reports a PDF with no text layer only when content scanning is enabled', async () => {
    const { mkdtemp, writeFile, rm } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { scan, check, loadPack } = await import('../src/engine.ts')
    const { readFile } = await import('node:fs/promises')
    const dir = await mkdtemp(join(tmpdir(), 'construction-content-'))
    try {
      await writeFile(join(dir, 'scan.pdf'), '%PDF-1.4\n%%EOF\n', 'latin1')
      const pack = loadPack(await readFile(join(import.meta.dirname, '../rules/construction-doc-check.yaml'), 'utf8'))
      const scanned = await scan(dir, { ...pack.scan, content: true })
      const report = check(pack, dir, scanned.files, scanned.dirs)
      expect(report.findings.some((finding) => finding.ruleId === 'CD-043')).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('CD-044 version/date rule', () => {
  it('reports a text-layer PDF with no date and stays quiet when a date is present', async () => {
    const { mkdtemp, writeFile, rm } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { readFile } = await import('node:fs/promises')
    const { scan, check, loadPack } = await import('../src/engine.ts')
    const pack = loadPack(await readFile(join(import.meta.dirname, '../rules/construction-doc-check.yaml'), 'utf8'))
    const dir = await mkdtemp(join(tmpdir(), 'construction-date-'))
    try {
      await writeFile(join(dir, 'dated.pdf'), minimalPdf('Document August 2026 page one'), 'latin1')
      const dated = await scan(dir, { ...pack.scan, content: true })
      const datedReport = check(pack, dir, dated.files, dated.dirs)
      expect(datedReport.findings.some((finding) => finding.ruleId === 'CD-044')).toBe(false)
      await writeFile(join(dir, 'undated.pdf'), minimalPdf('Document with no version marker'), 'latin1')
      const undated = await scan(dir, { ...pack.scan, content: true })
      const undatedReport = check(pack, dir, undated.files, undated.dirs)
      expect(undatedReport.findings.some((finding) => finding.ruleId === 'CD-044')).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('CD-045 section consistency', () => {
  it('reports a filename section that differs from the PDF header', async () => {
    const { mkdtemp, writeFile, rm } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { readFile } = await import('node:fs/promises')
    const { scan, check, loadPack } = await import('../src/engine.ts')
    const pack = loadPack(await readFile(join(import.meta.dirname, '../rules/construction-doc-check.yaml'), 'utf8'))
    const dir = await mkdtemp(join(tmpdir(), 'construction-section-'))
    try {
      await writeFile(join(dir, 'UFGS 02 00 00.pdf'), minimalPdf('UFGS-01 33 00 (August 2026) section'), 'latin1')
      const scanned = await scan(dir, { ...pack.scan, content: true })
      const report = check(pack, dir, scanned.files, scanned.dirs)
      expect(report.findings.some((finding) => finding.ruleId === 'CD-045')).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
