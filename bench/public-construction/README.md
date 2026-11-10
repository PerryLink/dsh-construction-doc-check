# Public-construction benchmark (UFGS, filename-level)

End-to-end regression benchmark for the **real** `dsh-construction-doc-check` plugin, using a small
public construction-document corpus. The plugin is imported from `../../lib/index.mjs` and its
`construction_doc_check` tool is called on temporary project directories. No scanner, matcher, or
rule engine is reimplemented here.

```text
fetch.mjs      download + verify six public PDFs into .data/ (gitignored)
adapter.mjs    public manifest -> temporary project dirs, preserving upstream filenames
evaluate.mjs   inject defects, call the real plugin, score three filename-level checks
summary.json   machine-readable results (generated)
RESULTS.md     human-readable results (generated)
```

## Corpus and source

Source: six **U.S. Unified Facilities Guide Specifications (UFGS)** sections, Division 01, published by
WBDG (Whole Building Design Guide) for USACE / NAVFAC / AFCEC / NASA.

| Section | Title | PDF | Landing page |
| --- | --- | --- | --- |
| 01 33 00 | Submittal Procedures | [PDF](https://www.wbdg.org/FFC/DOD/UFGS/UFGS%2001%2033%2000.pdf) | [page](https://www.wbdg.org/ffc/dod/unified-facilities-guide-specifications-ufgs/ufgs-01-33-00) |
| 01 45 00 | Quality Control | [PDF](https://www.wbdg.org/FFC/DOD/UFGS/UFGS%2001%2045%2000.pdf) | [page](https://www.wbdg.org/ffc/dod/unified-facilities-guide-specifications-ufgs/ufgs-01-45-00) |
| 01 78 00 | Closeout Submittals | [PDF](https://www.wbdg.org/FFC/DOD/UFGS/UFGS%2001%2078%2000.pdf) | [page](https://www.wbdg.org/ffc/dod/unified-facilities-guide-specifications-ufgs/ufgs-01-78-00) |
| 01 32 01.00 10 | Project Schedule | [PDF](https://www.wbdg.org/FFC/DOD/UFGS/UFGS%2001%2032%2001.00%2010.pdf) | [page](https://www.wbdg.org/ffc/dod/unified-facilities-guide-specifications-ufgs/ufgs-01-32-01-00-10) |
| 01 35 26 | Government Safety and Health Requirements | [PDF](https://www.wbdg.org/FFC/DOD/UFGS/UFGS%2001%2035%2026.pdf) | [page](https://www.wbdg.org/ffc/dod/unified-facilities-guide-specifications-ufgs/ufgs-01-35-26) |
| 01 74 19 | Construction Waste Management | [PDF](https://www.wbdg.org/FFC/DOD/UFGS/UFGS%2001%2074%2019.pdf) | [page](https://www.wbdg.org/ffc/dod/unified-facilities-guide-specifications-ufgs/ufgs-01-74-19) |

Retrieved **2026-11-10**. Exact byte sizes and SHA-256 digests are pinned in
[`sources.json`](sources.json); `fetch.mjs` refuses to benchmark a changed upstream file.

### License status

**U.S. federal government work; public domain in the United States under 17 U.S.C. § 105.**
No copyright notice was found in the six PDFs' text or metadata. This bench does **not** redistribute
them: they are downloaded to `.data/`, which is gitignored.

Supporting sources: [17 U.S.C. § 105](https://www.law.cornell.edu/uscode/text/17/105) and
[UFS 1-300-02, UFGS Format Standard](https://www.wbdg.org/FFC/DOD/UFC/ufs_1_300_02_2025.pdf)
(publicly distributed at no cost by WBDG; it is not itself a license grant).

Caveats, stated rather than hidden:

- WBDG's [site-level terms](https://www.wbdg.org/about/terms-use) were not separately verified (the
  site is a single-page application and the text was not machine-readable at retrieval time). The claim
  above is about the U.S. federal-work status of UFGS, not a claim that every WBDG asset is
  open-licensed.
- UFGS sections reference third-party standards that may have their own terms. Those referenced
  standards are not downloaded or redistributed here.
- This is not legal advice. If you need to redistribute the PDFs, verify the current WBDG/DoD terms
  yourself.

## Why this corpus cannot produce a Chinese-rule P/R

The shipped `rules/construction-doc-check.yaml` checks Chinese construction-project filing types:
竣工验收记录, 竣工报告, 保修书, 检验批, 隐蔽工程验收记录, 分部工程验收记录, 材料复试报告, 监理日志, 施工日志,
危大专项方案, 危大验收记录, 应急预案. A UFGS section is a **guide specification**, not a filled project
record. None of the twelve document-type rules has a semantically valid public counterpart:

- `01 78 00 Closeout Submittals` is a specification for closeout submittals, not a filled 竣工验收记录 or
  保修书.
- `01 45 00 Quality Control` is a QC specification, not a 监理日志.
- `01 35 26 Safety and Health Requirements` is a requirements specification, not a project-specific
  危大专项施工方案, acceptance record, or 应急预案.

[`adapter.mjs`](adapter.mjs) records this as an explicit `SEMANTIC_MAPPING` table with
`mappedTo: null` for every rule, and refuses to rename a PDF into a Chinese form. Forcing those
renames would manufacture a corpus that measures the adapter's fiction, not the plugin.

Consequently the shipped pack reports its 12 Chinese document types as missing in **every** case.
Those findings are recorded under `cases[].unscored` and are **not** counted as false positives.

## What is scored

Three checks only, each meaningful for a public filename corpus:

| Check | How it is exercised | Defect injected |
| --- | --- | --- |
| `presence` | A bench-generated pack with one anchored exact-filename rule per public document (rule ids `PB-001`…`PB-006`) is passed to the **real tool** via its supported `rulePackFile` argument. | Delete one or two documents. |
| `zeroByte` | Shipped rule `CD-041` (zero-byte files). | Truncate one or two PDFs to 0 bytes. |
| `staleVersion` | Shipped rule `CD-040` (revision-marked duplicates). | Add a byte-identical copy under `(1)`, `(2)`, or `V2`. |

`CD-042` (extension/file-header consistency) is **observed but not scored**. It naturally fires on
zero-byte `.pdf` files, but the benchmark's requested scored set is the three checks above.

### Cases

Nine cases, each built from the same six verified PDFs:

| Case | Layout | Injected defect |
| --- | --- | --- |
| `clean-flat` | flat | none |
| `clean-nested` | category folders | none |
| `missing-one` | flat | remove `UFGS 01 45 00.pdf` |
| `missing-two-nested` | category folders | remove `UFGS 01 33 00.pdf` and `UFGS 01 74 19.pdf` |
| `zero-one` | flat | truncate `UFGS 01 78 00.pdf` to 0 bytes |
| `zero-two-nested` | category folders | truncate `UFGS 01 32 01.00 10.pdf` and `UFGS 01 35 26.pdf` |
| `stale-paren` | flat | copy of `UFGS 01 33 00.pdf` as `UFGS 01 33 00 (1).pdf` |
| `stale-v2` | category folders | copy of `UFGS 01 78 00.pdf` as `UFGS 01 78 00 V2.pdf` |
| `mixed` | category folders | missing + zero-byte + stale in one project |

Labels are derived from case construction, before the plugin runs. A check is counted correct only when
the full expected and observed sets match exactly. Per-check precision/recall and the case-by-case table
are in [`RESULTS.md`](RESULTS.md); machine-readable counts are in [`summary.json`](summary.json).

## Reproduce

Prerequisites: Node.js 22.19+ or 24+, and a built plugin (`lib/index.mjs`). From the repository root:

```sh
pnpm install
pnpm run build

node bench/public-construction/fetch.mjs
node bench/public-construction/evaluate.mjs
```

`fetch.mjs` flags:

- `--check` — verify the already-downloaded PDFs against pinned size + SHA-256, no network.
- `--force` — re-download and re-verify; fails if upstream changed.

`evaluate.mjs` flags:

- `--keep` — keep the temporary project directories under `.tmp/` for inspection.
- `--from-summary` — re-render `RESULTS.md` from the existing `summary.json` without re-running the plugin.

Outputs are rewritten in place:

- `summary.json` — corpus metadata, semantic-mapping table, cases, per-check TP/FP/FN/TN, P/R/F1.
- `RESULTS.md` — generated report with source links, P/R table, case table, and limitations.

## Method and honest limits

- The plugin is called through its registered tool, not through a private import of the check core.
  `evaluate.mjs` does not reimplement scanning, matching, CD-040 grouping, or CD-041 byte checks.
- The presence pack is a benchmark fixture, not a legal/regulatory rule pack. It exists only to ask
  "are these six exact public filenames present?", which is the one presence question this corpus can
  legitimately answer.
- The corpus is six specification sections, not a project archive. It says nothing about Chinese
  filing completeness, and it cannot: those forms are not in it.
- The plugin does not parse document content. A file being present, non-empty, and uniquely named is
  not evidence that its contents are correct. This bench does not test content validity either.
- Case-level P/R with 9 cases and 3 positives per check is a **regression harness**, not a field
  accuracy estimate. Do not quote it as a population P/R.
- The snapshot is pinned by URL, size, and SHA-256. Upstream WBDG documents are mutable; a changed
  file fails the fetch instead of silently changing the benchmark.
- Only filenames, file sizes, and the PDF header are exercised. No network is used during evaluation;
  no credentials or tokens are involved at any point.
