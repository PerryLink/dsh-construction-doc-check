import Schema from '@deepseek-ai/schemastery'

/** Tunables an operator can change from `cordis.yml`. */
export interface Config {
  /** Tool timeout budget in milliseconds. */
  timeoutMs: number
  /** Rule-pack path relative to the package root. */
  rulePackFile: string
}

export const Config: Schema<Config> = Schema.object({
  timeoutMs: Schema.number().default(120_000).description('工具超时预算（毫秒）。'),
  rulePackFile: Schema.string().default('rules/construction-doc-check.yaml').description('规则库路径。'),
})
