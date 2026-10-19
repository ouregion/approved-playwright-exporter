import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { assembleSuite } from '../src/exporter.mjs';
import { validateSuite } from '../src/validator.mjs';
import { sampleInput } from '../src/sample.mjs';
import { canonicalHash } from '../src/contracts.mjs';

async function scratch(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'synthetic-suite-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return dir;
}

test('exports an independently validated suite with an assertion-bearing spec', async t => {
  const input = sampleInput(); input.session = { fakeCookie: 'not copied' };
  const first = await assembleSuite(input, await scratch(t));
  const result = await promisify(execFile)(process.execPath, [path.join(first.directory, 'scripts/validate.mjs')]);
  assert.equal(JSON.parse(result.stdout).valid, true);
  await promisify(execFile)(process.execPath, ['--check', path.join(first.directory, first.manifest.testMatch[0])]);
  assert.match(await fs.readFile(path.join(first.directory, first.manifest.testMatch[0]), 'utf8'), /toHaveText/);
  assert.equal(first.manifest.files.some(f => /session|cookie|\.env/.test(f.path)), false);
  await fs.appendFile(path.join(first.directory, 'fixtures/page.html'), '<!-- changed -->');
  await assert.rejects(promisify(execFile)(process.execPath, [path.join(first.directory, 'scripts/validate.mjs')]),
    error => error.code === 1 && JSON.parse(error.stdout).valid === false);
});
test('rejects stale plan approvals before writing', async t => {
  const input = sampleInput(); input.plan.revision++;
  const dir = await scratch(t);
  await assert.rejects(assembleSuite(input, dir), /APPROVAL_MISMATCH/);
  assert.deepEqual(await fs.readdir(dir), []);
});
test('rejects a mismatched approval revision even with matching hashes', async t => {
  const input = sampleInput(); input.approval.planRevision = 2;
  await assert.rejects(assembleSuite(input, await scratch(t)), /APPROVAL_MISMATCH/);
});
test('rejects unverified and duplicate scenarios', async t => {
  const input = sampleInput(); input.verification.scenarios = [];
  await assert.rejects(assembleSuite(input, await scratch(t)), /UNQUALIFIED/);
  const duplicate = sampleInput(); duplicate.generated.push(duplicate.generated[0]);
  await assert.rejects(assembleSuite(duplicate, await scratch(t)), /INVALID_SCENARIO_ID/);
});
test('detects changed and missing immutable files', async t => {
  const suite = await assembleSuite(sampleInput(), await scratch(t));
  await fs.appendFile(path.join(suite.directory, 'fixtures/page.html'), '<p>changed</p>');
  assert.ok((await validateSuite(suite.directory)).errors.some(s => s.startsWith('Hash mismatch')));
  await fs.unlink(path.join(suite.directory, 'fixtures/page.html'));
  assert.ok((await validateSuite(suite.directory)).errors.some(s => s.startsWith('Missing file')));
});
test('rejects traversal IDs and imports escaping the suite', async t => {
  const input = sampleInput(); input.generated[0].scenarioId = '../../escape';
  await assert.rejects(assembleSuite(input, await scratch(t)), /INVALID_SCENARIO_ID/);
  const escaped = sampleInput(); escaped.generated[0].source += "import '../../../outside.mjs';\n";
  await assert.rejects(assembleSuite(escaped, await scratch(t)), /Import escapes suite/);
});
test('rejects manifest paths escaping the suite', async t => {
  const suite = await assembleSuite(sampleInput(), await scratch(t));
  suite.manifest.files.push({ path: '../outside', sha256: 'a'.repeat(64) });
  await fs.writeFile(path.join(suite.directory, 'manifest.json'), JSON.stringify(suite.manifest));
  assert.equal((await validateSuite(suite.directory)).valid, false);
});
test('does not mutate plan content or accept credential-shaped fields', async t => {
  const input = sampleInput(); const before = canonicalHash(input.plan);
  await assembleSuite(input, await scratch(t));
  assert.equal(canonicalHash(input.plan), before);
  input.plan.apiKey = 'synthetic-placeholder';
  await assert.rejects(assembleSuite(input, await scratch(t)), /Credentials/);
});
