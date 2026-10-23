import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { Config } from './config.ts'
import type { Config as ConfigShape } from './config.ts'
import { check, loadPack, scan } from './engine.ts'
import { findingJson, renderMarkdown } from './report.ts'

export const name = 'dsh-construction-doc-check'
export const inject = ['tools']
export { Config }

/** Tool id exposed to the model, and the row id in `cordis.patch.yml`. */
export const TOOL_NAME = 'construction_doc_check'

/**
 * Resolve a package-owned file such as the rule pack.
 *
 * @param relative - configured path, relative to the package root.
 * @returns the resolved absolute path.
 */
export function resolvePackageFile(relative: string): string {
  if (isAbsolute(relative)) return relative
  const tried: string[] = []
  let directory = import.meta.dirname
  for (;;) {
    const candidate = join(directory, relative)
    tried.push(candidate)
    if (existsSync(candidate)) return candidate
    const parent = dirname(directory)
    if (parent === directory) break
    directory = parent
  }
  const fromCwd = resolve(relative)
  if (existsSync(fromCwd)) return fromCwd
  throw new Error(`找不到 ${relative}；尝试过：\n${[...tried, fromCwd].join('\n')}`)
}

/**
 * Register the completeness tool.
 *
 * @param ctx - plugin context, with `tools` already available.
 * @param config - validated configuration.
 */
export function apply(ctx: Context, config: ConfigShape): () => void {
  return ctx.tools.register(
    defineTool({
      name: TOOL_NAME,
      description:
        '扫描施工项目资料目录，按文件名核对规则库列出的每一类资料是否存在，并报告疑似残留旧版本与零字节文件。' +
        '只按文件名判断：不打开文件、不核对内容、不判断份数。缺件说明归档无法证明做过，不等于现场没做。',
      parameters: {
        dir: { type: 'string', description: '资料归档目录的绝对路径。' },
        rulePackFile: { type: 'string', description: '覆盖配置中的规则库路径。' },
        maxDepth: { type: 'number', description: '覆盖规则库里的递归深度上限。' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            plugin: { type: 'string' },
            target: { type: 'string' },
            packVersion: { type: 'string' },
            summary: {
              type: 'object',
              additionalProperties: false,
              properties: {
                present: { type: 'integer' },
                missing: { type: 'integer' },
                errors: { type: 'integer' },
                warnings: { type: 'integer' },
                infos: { type: 'integer' },
                dirsScanned: { type: 'integer' },
                filesScanned: { type: 'integer' },
              },
            },
            missingCategories: { type: 'array', items: { type: 'string' } },
            markdown: { type: 'string' },
            resultJson: { type: 'string' },
          },
        },
        render: (_args, value) => [{ type: 'text', text: (value as { markdown: string }).markdown }],
      },
      timeoutMs: config.timeoutMs,
      isConcurrencySafe: () => true,
      async execute(args, exec) {
        if (args.dir === undefined || args.dir.trim() === '') throw new Error('必须提供 dir（资料归档目录）')
        const root = resolve(args.dir)
        exec.signal.throwIfAborted()

        const packPath = resolvePackageFile(args.rulePackFile?.trim() || config.rulePackFile)
        const pack = loadPack(await readFile(packPath, 'utf8'))
        if (args.maxDepth !== undefined) pack.scan.maxDepth = args.maxDepth

        const { files, dirs, warnings: scanWarnings } = await scan(root, pack.scan)
        exec.signal.throwIfAborted()

        const result = check(pack, root, files, dirs)
        result.warnings.unshift(...scanWarnings)
        const markdown = renderMarkdown(result, pack.version)
        const missingCategories = result.findings
          .filter((item) => item.message.includes('没有找到'))
          .map((item) => `${item.ruleId} ${item.title}`)

        return {
          plugin: name,
          target: root,
          packVersion: pack.version,
          summary: { ...result.summary, filesScanned: files.length },
          missingCategories,
          markdown,
          resultJson: JSON.stringify(findingJson(result)),
        }
      },
    }),
  )
}
