import { fileURLToPath } from 'node:url';
import { validateSuite } from './validator.mjs';
const result = await validateSuite(fileURLToPath(new URL('../', import.meta.url)));
console.log(JSON.stringify(result));
process.exitCode = result.valid ? 0 : 1;
