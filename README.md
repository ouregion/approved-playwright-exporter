# Approved Playwright Suite Exporter

A small, runnable packaging demo for approved test scenarios. It binds approval to a plan hash and revision, exports explicitly selected files, and validates the package using an independent CLI.

## Run without a browser

Node 20 or newer is required. The exporter and its tests use only Node standard libraries and need no installation:

```sh
npm test
npm run demo
```

The demo writes a new suite under `demo-output/`, checks it, modifies the synthetic fixture, confirms a hash mismatch, restores the original bytes, and checks it again. It never opens a browser or starts a service. `config.example.json` describes the fixed synthetic plan parameters; it is a documentation template, not automatically loaded configuration.

For any generated suite, run `node scripts/validate.mjs` from that suite's directory. It exits 0 for a consistent package and 1 for an invalid package. This replaces the source project's placeholder validator in this extracted copy only.

## Included behavior

- Plan hash and revision must match the approval; verification must reference the same hash.
- Only approved, fixture-marked verified scenario IDs are exported.
- Template and support files come from explicit allowlists.
- Manifest checks detect changed/missing listed files, unsafe paths and escaping relative imports.
- The synthetic spec contains a real `toHaveText` assertion against an included HTML fixture using `page.setContent`.

The demo's `verified` status is a hand-authored fixture marker. This package does not independently establish browser behavior before exporting.

## Validation and remaining work

**8 Node tests passed** on Node 20.20.2 on 2026-10-18. They exercise the independent validation process, stale approval rejection, duplicate/unverified scenarios, path traversal, missing/changed files, and exclusion of designated private input objects. The generated spec passed Node's syntax check. The demo separately reproduced valid → tampered → restored outcomes.

**Browser assertions have not been executed.** The exported suite declares Playwright 1.63.0 with a scoped lockfile, but clean dependency installation, a passing browser run, and detection of an intentionally regressed page remain unverified. No CI run is claimed.

This is a narrow extraction and new wrapper around a personal prototype's exporter/contracts pattern. It excludes the original scanner, UI, model integration, authentication, storage state, environment files, baselines and historical artifacts. Those broader prototype workflows remain unfinished and are not included here.

The manifest is unsigned. Checks on listed files and simple relative-import inspection are not a sandbox, complete source-code analysis, or assurance that arbitrary generated code is safe. The source strings in this demo are fixed and hand-authored.

See [PROVENANCE.md](PROVENANCE.md). The owner’s source code and additions use the [MIT license](LICENSE). Dependencies retain their own licenses; Playwright is an Apache-2.0 dependency and its implementation is not vendored in this repository.
