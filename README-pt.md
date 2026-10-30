# dsh-construction-doc-check — Construction document check (Português)

[English](README.md) · [简体中文](README-zh.md) · [Español](README-es.md) · [Português](README-pt.md) · [हिन्दी](README-hi.md)

[![dshfind](https://dshfind.com/api/badge/PerryLink/dsh-construction-doc-check?metric=downloads)](https://dshfind.com/en/plugins/PerryLink/dsh-construction-doc-check?ref=badge)

`dsh-construction-doc-check` percorre o arquivo documental de uma obra e reporta que tipos de documento exigidos faltam, quais parecem revisões antigas ao lado da vigente e que ficheiros estão vazios.

Lê nomes de ficheiro, não ficheiros. É um limite deliberado: um arquivo real tem mil documentos e pedir ao responsável que os transcreva antes dá mais trabalho, não menos.

## Install

```sh
dsh plugin --profile <name> add dsh-construction-doc-check
dsh --profile <name> --dump-config | grep 'dsh-construction-doc-check'
```

## What it looks like

![Workflow diagram for dsh-construction-doc-check: document → rule pack → findings.](docs/assets/dsh-construction-doc-check-flow.svg)

*Workflow overview: document → rule pack → findings.*

**Limite:** três afirmações que esta ferramenta não faz. Não abre documentos, pelo que «presente» não é «correto». Não julga **quantas** cópias devem existir de cada tipo. E um ficheiro ausente significa que o arquivo não pode provar que foi feito, não que não tenha sido feito.

## What it answers

- Que tipos de documento exigidos não aparecem no arquivo?
- Que documentos existem em mais do que uma revisão ao mesmo tempo?
- Que ficheiros têm zero bytes e são inutilizáveis?
- Que requisito falta e que cláusula o exige?

## Standards it follows

Os requisitos são citados literalmente das cláusulas que os criam: GB 50300-2013, o Regulamento de qualidade da construção (Portaria 279) artigos 16.º e 29.º, e a Portaria 37 sobre obras perigosas. Dois requisitos são `institutional-configuration` por virem da política interna de arquivo, e nunca podem ser `error`.

## Compatibility

| Surface | Status |
|---|---|
| Harness | peer range `>=0.1.2-rc.1 <0.2.0 \|\| >=0.2.0-0 <0.3.0` |
| Node | `^22.19.0 || >=24.0.0` |
| Platforms | all (pure ESM; no native code, no network, no model call) |

## What it does

Fourteen rules: twelve match a document kind by pattern against the relative path (folders count), and two are set-level (revision leftovers, zero-byte files).

## Configuration

| Key | Default | Meaning |
|---|---|---|
| `rulesFile` | `rules/construction-doc-check.yaml` | 规则库路径 |

## Material format

Input is a directory; the pack declares the patterns, the skip list and the depth cap.

## Rule sources

Quotations live in `rules/evidence/clauses.md` and in the pack. Known limits: matching is by name, so a correctly named but wrong document counts as present; counts are not judged; and a deeply nested archive can report a file as missing when it sits one level past the depth cap, which the report says when it happens.

## Troubleshooting

- **The plugin installs but the tool never appears**: check that `main` resolves to `lib/index.mjs` and that `pnpm run build` produced it.
- **`dsh plugin add` rejects the package**: the peer range covers `0.1.x` and `0.2.x`; outside it, grant an explicit exemption.
- **A rule did not run**: read the `skipped` array.

## Development

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run build
node ../scripts/sync-shared.mjs dsh-construction-doc-check
```

## PerryLink DSH Plugin Family

Full family index: [choose a checker by material](https://perrylink.github.io/zh/checkers/choose/) and [all plugins](https://github.com/PerryLink). This repository is one of them.

## License

[Apache License 2.0](LICENSE) © 2026 dsh-construction-doc-check contributors.
