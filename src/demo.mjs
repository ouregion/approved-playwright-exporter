import fs from 'node:fs/promises';
import path from 'node:path';
import { assembleSuite } from './exporter.mjs';
import { sampleInput } from './sample.mjs';
import { validateSuite } from './validator.mjs';

const destination = process.argv[2] || 'demo-output';
const suite = await assembleSuite(sampleInput(), destination);
const before = await validateSuite(suite.directory);
const target = path.join(suite.directory, 'fixtures/page.html');
const original = await fs.readFile(target);
await fs.appendFile(target, '<!-- deliberate tamper -->');
const tampered = await validateSuite(suite.directory);
await fs.writeFile(target, original);
const restored = await validateSuite(suite.directory);
if (!before.valid || tampered.valid || !restored.valid) throw Error('Unexpected demo outcome');
console.log(JSON.stringify({ suite: path.relative(process.cwd(), suite.directory), before, tampered, restored,
  browserExecuted: false, verificationOrigin: 'synthetic fixture assertion, browser acceptance pending' }, null, 2));
