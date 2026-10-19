// Narrow adaptation of the source suite assembler: explicit files, no sessions.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalHash, validate, assertNoCredentialFields } from './contracts.mjs';
import { sha256, validateSuite } from './validator.mjs';

const templates = fileURLToPath(new URL('../templates/', import.meta.url));
const templateFiles = ['package.json', 'package-lock.json', 'LICENSE', 'playwright.config.mjs', 'scripts/validate.mjs'];
const validId = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(value);

export async function assembleSuite(input, destination) {
  validate('plan', input.plan);
  validate('approval', input.approval);
  assertNoCredentialFields({ plan: input.plan, approval: input.approval });
  const planHash = canonicalHash(input.plan);
  if (input.approval.planHash !== planHash || input.verification?.planHash !== planHash
      || input.approval.planRevision !== input.plan.revision) throw Error('APPROVAL_MISMATCH');
  const approved = new Set(input.approval.approvedIds);
  const verified = new Set(input.verification.scenarios.filter(s => s.status === 'verified').map(s => s.scenarioId));
  const scenarios = new Map(input.plan.scenarios.map(s => [s.id, s]));
  const selected = new Set();
  const sources = [];
  for (const item of input.generated) {
    const scenario = scenarios.get(item.scenarioId);
    if (!validId(item.scenarioId) || selected.has(item.scenarioId)) throw Error('INVALID_SCENARIO_ID');
    if (!scenario || !approved.has(item.scenarioId) || !verified.has(item.scenarioId)) throw Error('UNQUALIFIED_SOURCE');
    if (typeof item.source !== 'string' || !item.source.trim()) throw Error('EMPTY_SOURCE');
    selected.add(item.scenarioId);
    sources.push({ path: `tests/integrity/${item.scenarioId}.spec.mjs`, bytes: item.source });
  }
  if (!sources.length) throw Error('EMPTY_SUITE');
  const directory = path.resolve(destination, `suite-${crypto.randomUUID()}`);
  await fs.mkdir(directory, { recursive: true });
  const files = [];
  async function write(relative, bytes) {
    const target = path.join(directory, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes);
    files.push({ path: relative, sha256: sha256(bytes) });
  }
  for (const file of templateFiles) await write(file, await fs.readFile(path.join(templates, file)));
  await write('scripts/validator.mjs', await fs.readFile(new URL('./validator.mjs', import.meta.url)));
  await write('fixtures/page.html', await fs.readFile(new URL('../fixtures/page.html', import.meta.url)));
  for (const source of sources) await write(source.path, source.bytes);
  await write('plan.json', JSON.stringify(input.plan, null, 2));
  await write('approval.json', JSON.stringify(input.approval, null, 2));
  const manifest = { schemaVersion: 1, planHash, approvalHash: canonicalHash(input.approval),
    verificationHash: canonicalHash(input.verification), files, testMatch: sources.map(s => s.path) };
  await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  const result = await validateSuite(directory);
  if (!result.valid) throw Error(result.errors.join('; '));
  return { directory, manifest };
}
