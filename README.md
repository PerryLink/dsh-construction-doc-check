# dsh-construction-doc-check — Construction document check

[English](README.md) · [简体中文](README-zh.md) · [Español](README-es.md) · [Português](README-pt.md) · [हिन्दी](README-hi.md)

<!-- topblock:v1 -->
> **What it is** — Scans a construction document folder and reports missing required documents, likely old versions and empty files.
> **Who it is for** — construction document controllers.
> **What you give it** — a construction document folder (file names and structure only)
> **What it does not do** — no compliance verdict, no liability finding, no replacement for the reviewer; differences only.
> **How to start** — from the command line (not sold separately yet):
> `dsh plugin --profile <name> add dsh-construction-doc-check`
<!-- /topblock:v1 -->

[![dshfind](https://dshfind.com/api/badge/PerryLink/dsh-construction-doc-check?metric=downloads)](https://dshfind.com/en/plugins/PerryLink/dsh-construction-doc-check?ref=badge)

`dsh-construction-doc-check` walks a project's document archive and reports which required document types are missing, which look like stale revisions sitting next to the current copy, and which files are empty.

It reads file names, not files. That is a deliberate ceiling: a real archive holds a thousand documents, and asking a 资料员 to transcribe them into a table first gives him more work, not less. The folder and the filenames are what he already has.

## Install

```sh
dsh plugin --profile <name> add dsh-construction-doc-check
dsh --profile <name> --dump-config | grep 'dsh-construction-doc-check'
```

## What it looks like

![Workflow diagram for dsh-construction-doc-check: document → rule pack → findings.](docs/assets/dsh-construction-doc-check-flow.svg)

*Workflow overview: document → rule pack → findings.*

**Boundary:** three claims this tool does not make. It does not open a document, so "present" is not "correct" — content is a later layer. It does not judge **how many** copies of a kind should exist: one subitem can need dozens of 检验批 records, and this checks existence, not sufficiency. And a missing file means the archive cannot prove the work was done, which is not the same as the work not being done.

## What it answers

- Which required document types cannot be found anywhere in the archive?
- Which documents exist in more than one revision side by side?
- Which files are zero bytes, and therefore present but unusable?
- Which named requirement is missing, and which clause requires it?

## Standards it follows

Requirements are quoted from the clauses that create them, verbatim:

- 《建筑工程施工质量验收统一标准》GB 50300-2013 — 检验批, 隐蔽工程, 分部验收, 竣工验收四张表.
- 《建设工程质量管理条例》国务院令第279号 第十六条, 第二十九条 — 竣工报告, 保修书, 材料检验.
- 《危险性较大的分部分项工程安全管理规定》住建部令第37号 — 专项方案与验收.

Two requirements are marked `institutional-configuration` because they come from the organisation's own filing policy rather than a national standard; those can never be an `error`.

## Compatibility

| Surface | Status |
|---|---|
| Harness | peer range `>=0.1.2-rc.1 <0.2.0 \|\| >=0.2.0-0 <0.3.0` |
| Node | `^22.19.0 || >=24.0.0` |
| Platforms | all (pure ESM; no native code, no network, no model call) |

## What it does

Fourteen rules. Twelve match a kind of document by pattern against the **relative path** — folders count, because real archives classify by folder. Two are set-level: `CD-040` reports the same document name appearing more than once with a revision marker (`(1)`, `副本`, `最终`, `V2`), and `CD-041` reports zero-byte files.

A zero-byte file still satisfies the requirement that the kind exists, and is reported separately: "there is a file" and "the file is usable" are different statements, and the report makes both.

## Configuration

| Key | Default | Meaning |
|---|---|---|
| `rulesFile` | `rules/construction-doc-check.yaml` | 规则库路径 |

## Material format

Input is a directory. The pack declares what to look for:

```yaml
- id: CD-020
  title: 危大工程应有专项施工方案
  category: 危大工程
  severity: error
  patterns: [专项施工方案]
```

Directories named in `scan.skipDirs` (`.git`, `node_modules`, `旧版备份`, …) are skipped whole. Depth is capped at `scan.maxDepth` (6 by default) and the report says when the cap was hit.

## Rule sources

Quotations live in `rules/evidence/clauses.md` and in the pack; `check:citations` verifies each appears verbatim.

Known limits: matching is by name, so a correctly named but wrong document counts as present. Counts are not judged — that needs the subitem breakdown, which is the L1 layer. And the scan's depth cap means a deeply nested archive can report a document as missing when it sits one level too deep; the report says so when the cap is reached.

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
