/**
 * Markdown report for a construction-document completeness scan.
 *
 * The report says what it did not look at before it lists what it found. A folder
 * with three missing categories and no statement of scope reads as "three files
 * missing", when the real claim is "three document types the archive cannot
 * demonstrate" — and neither means the work was not done.
 */

import type { ConstructionResult } from './engine.ts'

/**
 * Render the scan as markdown.
 *
 * @param result - scan outcome.
 * @param packVersion - rule pack version.
 * @returns markdown text.
 */
export function renderMarkdown(result: ConstructionResult, packVersion: string): string {
  const lines: string[] = []
  lines.push('# 施工资料完整性核查')
  lines.push('')
  lines.push(`- 检查对象：${result.root}`)
  lines.push(`- 规则库版本：${packVersion}`)
  lines.push(`- 扫描结果：${result.summary.dirsScanned} 个目录、${result.files.length} 个文件`)
  lines.push(
    `- 结果统计：缺件 ${result.summary.missing} 类 · 错误 ${result.summary.errors} · 提示 ${result.summary.warnings} · 参考 ${result.summary.infos}`,
  )
  lines.push('')
  lines.push('## 本报告能说明什么')
  lines.push('')
  lines.push('- **只按文件名判断**：不打开文件，不核对内容，不判断填写是否合格。')
  lines.push('- **「没有这一类文件」= 归档无法证明做过**，不等于现场没做。')
  lines.push('- **不判断份数**：一个分项几十份检验批，本工具只判断「有没有」，不判断「够不够」。')
  lines.push('')

  const missing = result.findings.filter((item) => item.evidence.length === 0 && item.message.includes('没有找到'))
  if (missing.length === 0) {
    lines.push('## 未发现缺件')
    lines.push('')
    lines.push('规则库列出的每一类资料，归档中都能按文件名找到至少一份。')
  } else {
    lines.push('## 缺件清单')
    lines.push('')
    const order: Record<string, number> = { error: 0, warn: 1, info: 2 }
    for (const item of [...missing].sort((left, right) => (order[left.severity] ?? 9) - (order[right.severity] ?? 9))) {
      const label = item.severity === 'error' ? '错误' : item.severity === 'warn' ? '提示' : '参考'
      lines.push(`- **[${label}] ${item.ruleId}**（${item.category}）${item.message}`)
      lines.push(`  - 依据：${item.basis}`)
    }
  }

  const others = result.findings.filter((item) => !missing.includes(item))
  if (others.length > 0) {
    lines.push('')
    lines.push('## 其他发现')
    lines.push('')
    for (const item of others) {
      const label = item.severity === 'error' ? '错误' : item.severity === 'warn' ? '提示' : '参考'
      lines.push(`- **[${label}] ${item.ruleId}** ${item.message}`)
      if (item.evidence.length > 0) {
        for (const path of item.evidence.slice(0, 8)) lines.push(`  - ${path}`)
        if (item.evidence.length > 8) lines.push(`  - …… 另有 ${item.evidence.length - 8} 项`)
      }
      lines.push(`  - 依据：${item.basis}`)
    }
  }

  if (result.warnings.length > 0) {
    lines.push('')
    lines.push('## 提示')
    lines.push('')
    for (const warning of [...new Set(result.warnings)]) lines.push(`- ${warning}`)
  }

  lines.push('')
  lines.push('## 边界')
  lines.push('')
  lines.push('本报告只核对归档目录里按文件名能否找到某一类资料，不核对内容，不判断份数，不替代资料员自检与监理审查。')
  lines.push('缺件不等于未做：它说明归档无法证明。请按本清单补齐资料或补充说明。')
  lines.push('')
  return lines.join('\n')
}

/** One finding as a plain object for the JSON result. */
export function findingJson(result: ConstructionResult): Record<string, unknown> {
  return {
    root: result.root,
    summary: result.summary,
    findings: result.findings.map((item) => ({
      ruleId: item.ruleId,
      severity: item.severity,
      category: item.category,
      title: item.title,
      message: item.message,
      evidence: item.evidence,
    })),
    warnings: result.warnings,
  }
}
