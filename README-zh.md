# dsh-construction-doc-check — 施工资料目录完整性核对

[English](README.md) · [简体中文](README-zh.md) · [Español](README-es.md) · [Português](README-pt.md) · [हिन्दी](README-hi.md)

<!-- topblock:v1 -->
> **这是什么**　扫一个施工项目资料文件夹的目录结构，报告缺哪些规定资料、哪些像过期版本、哪些文件是空的。
> **给谁用**　施工资料员、监理、建设单位资料管理。
> **你交什么**　一个施工项目资料文件夹（只看文件名与目录结构，不读文件内容）。
> **它不做什么**　不判合规、不认定责任、不替代审核人；只列材料内部能逐条指认的差异。
> **怎么开始**　命令行安装（暂未单独上架）：
> `dsh plugin --profile <name> add dsh-construction-doc-check`
<!-- /topblock:v1 -->

[![dshfind](https://dshfind.com/api/badge/PerryLink/dsh-construction-doc-check?metric=downloads)](https://dshfind.com/en/plugins/PerryLink/dsh-construction-doc-check?ref=badge)

`dsh-construction-doc-check` 扫描项目资料归档目录，报告缺哪些规定资料、哪些像是和现行版本并排的旧版本、哪些文件是空的。

它读的是文件名，不是文件。这是刻意的上限：一个真实归档有上千份文件，先让资料员整理成表格再核对，是给他加活不是减活。目录和文件名是他已经有的东西。

## Install

```sh
dsh plugin --profile <name> add dsh-construction-doc-check
dsh --profile <name> --dump-config | grep 'dsh-construction-doc-check'
```

## What it looks like

![Workflow diagram for dsh-construction-doc-check: document → rule pack → findings.](docs/assets/dsh-construction-doc-check-flow.svg)

*Workflow overview: document → rule pack → findings.*

**边界：** 三句本工具不说的话。它不打开文件，所以「有」不等于「合格」——内容由后续层级负责。它**不判断份数**：一个分项可能要几十份检验批，本工具只判断有没有，不判断够不够。缺件说明归档无法证明做过，不等于没做过。

## What it answers

- 哪些规定资料在归档里完全找不到？
- 哪些资料同时存在多个版本？
- 哪些文件是零字节，也就是「有但用不了」？
- 某条要求缺的是哪一类文件、依据哪一条？

## Standards it follows

要求来自创设它的条款，逐字引用：

- 《建筑工程施工质量验收统一标准》GB 50300-2013 —— 检验批、隐蔽、分部验收、竣工验收四张表。
- 《建设工程质量管理条例》国务院令第279号 第十六条、第二十九条 —— 竣工报告、保修书、材料检验。
- 《危险性较大的分部分项工程安全管理规定》住建部令第37号 —— 专项方案与验收。

另有两条标 `institutional-configuration`，因为它们来自本机构归档办法而非国家标准，永不到 `error`。

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

完整清单（62 个核查器 + 通用插件）见 [按材料选核查器](https://perrylink.github.io/zh/checkers/choose/)；本仓只是其中一个。

## License

[Apache License 2.0](LICENSE) © 2026 dsh-construction-doc-check contributors.
