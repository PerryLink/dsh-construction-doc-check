# dsh-construction-doc-check — Construction document check (Español)

[English](README.md) · [简体中文](README-zh.md) · [Español](README-es.md) · [Português](README-pt.md) · [हिन्दी](README-hi.md)

[![dshfind](https://dshfind.com/api/badge/PerryLink/dsh-construction-doc-check?metric=downloads)](https://dshfind.com/en/plugins/PerryLink/dsh-construction-doc-check?ref=badge)

`dsh-construction-doc-check` recorre el archivo documental de una obra e informa qué tipos de documento exigidos faltan, cuáles parecen revisiones antiguas junto a la vigente y qué archivos están vacíos.

Lee nombres de archivo, no archivos. Es un límite deliberado: un archivo real tiene mil documentos y pedir al responsable que los transcriba antes da más trabajo, no menos.

## Install

```sh
dsh plugin --profile <name> add dsh-construction-doc-check
dsh --profile <name> --dump-config | grep 'dsh-construction-doc-check'
```

## What it looks like

![Workflow diagram for dsh-construction-doc-check: document → rule pack → findings.](docs/assets/dsh-construction-doc-check-flow.svg)

*Workflow overview: document → rule pack → findings.*

**Límite:** tres afirmaciones que esta herramienta no hace. No abre documentos, así que «presente» no es «correcto». No juzga **cuántas** copias debe haber de cada tipo. Y un archivo ausente significa que el archivo documental no puede probar que se hizo, no que no se hiciera.

## What it answers

- ¿Qué tipos de documento exigidos no aparecen en el archivo?
- ¿Qué documentos existen en más de una revisión a la vez?
- ¿Qué archivos tienen cero bytes y por tanto son inutilizables?
- ¿Qué requisito falta y qué cláusula lo exige?

## Standards it follows

Los requisitos se citan literalmente de las cláusulas que los crean: GB 50300-2013 (inspección por lotes, obra oculta, aceptación de partes y de la unidad), el Reglamento de calidad de la construcción (Orden 279) artículos 16 y 29, y la Orden 37 sobre obras peligrosas. Dos requisitos son `institutional-configuration` porque proceden de la política interna de archivo, y nunca pueden ser `error`.

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
