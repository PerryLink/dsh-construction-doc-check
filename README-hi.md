# dsh-construction-doc-check — Construction document check (हिन्दी)

[English](README.md) · [简体中文](README-zh.md) · [Español](README-es.md) · [Português](README-pt.md) · [हिन्दी](README-hi.md)

[![dshfind](https://dshfind.com/api/badge/PerryLink/dsh-construction-doc-check?metric=downloads)](https://dshfind.com/en/plugins/PerryLink/dsh-construction-doc-check?ref=badge)

`dsh-construction-doc-check` किसी परियोजना के दस्तावेज़ संग्रह को देखकर बताता है कि कौन-से अनिवार्य दस्तावेज़ प्रकार अनुपस्थित हैं, कौन-से वर्तमान प्रति के साथ पुराने संस्करण जैसे पड़े हैं, और कौन-सी फ़ाइलें खाली हैं।

यह फ़ाइल के नाम पढ़ता है, फ़ाइल नहीं। यह जानबूझकर तय की गई सीमा है: वास्तविक संग्रह में हज़ार दस्तावेज़ होते हैं, और पहले उन्हें तालिका में उतारने को कहना काम बढ़ाना है, घटाना नहीं।

## Install

```sh
dsh plugin --profile <name> add dsh-construction-doc-check
dsh --profile <name> --dump-config | grep 'dsh-construction-doc-check'
```

## What it looks like

![Workflow diagram for dsh-construction-doc-check: document → rule pack → findings.](docs/assets/dsh-construction-doc-check-flow.svg)

*Workflow overview: document → rule pack → findings.*

**सीमा:** तीन बातें यह उपकरण नहीं कहता। यह दस्तावेज़ नहीं खोलता, इसलिए «मौजूद» का अर्थ «सही» नहीं। यह **कितनी** प्रतियाँ होनी चाहिए यह नहीं आँकता। और फ़ाइल का अनुपस्थित होना बताता है कि संग्रह प्रमाण नहीं दे सकता, यह नहीं कि काम हुआ ही नहीं।

## What it answers

- कौन-से अनिवार्य दस्तावेज़ प्रकार संग्रह में कहीं नहीं मिले?
- कौन-से दस्तावेज़ एक साथ कई संस्करणों में हैं?
- कौन-सी फ़ाइलें शून्य बाइट की हैं, यानी मौजूद पर अनुपयोगी?
- कौन-सी आवश्यकता छूटी और कौन-सा अनुच्छेद उसे अनिवार्य करता है?

## Standards it follows

आवश्यकताएँ उन्हीं अनुच्छेदों से शब्दशः उद्धृत हैं जो उन्हें बनाते हैं: GB 50300-2013, निर्माण गुणवत्ता विनियम (आदेश 279) अनुच्छेद 16 व 29, और जोखिमभरा कार्य आदेश 37। दो आवश्यकताएँ `institutional-configuration` हैं क्योंकि वे संस्था की संग्रह नीति से आती हैं, और कभी `error` नहीं हो सकतीं।

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
