# Changelog

## 0.1.1

**Fixes three rules that overstated their authority.** CD-030, CD-040 and CD-041 were
`severity: warn` while their `basis.kind` is `institutional-configuration` — a
requirement that comes from the organisation's own filing policy, not from a national
standard. The family caps that kind at `info` precisely so a reader is never told
「法规要求」 about something the company decided for itself.

Found by the new family-wide `scripts/audit-basis.mjs`, which applies the severity
ceiling across every pack. This package's own tests did not, because it is not a
table plugin and does not use the shared suite that enforces the ceiling.

No rule removed; the three still fire, one severity down.


## 0.1.0

First release. L0 completeness scan: filename-only, no document is opened.

- Twelve requirements checked by directory and file name, plus two set-level
  checks (revision leftovers, zero-byte files).
- **Matches the relative path, not just the file name.** Real archives classify by
  folder — `危大工程/模板工程验收记录.docx` — so requiring the keyword in the file
  name alone reported a document that was plainly present as missing.
- A zero-byte file still counts as present for the requirement and is reported
  separately: "the file is there" and "the file is usable" are different claims.
- The report states its scope before its findings: filename-only, missing does not
  mean not done, and counts are not judged.
- 13 tests over generated directory trees.
