import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const safePath = value => typeof value === 'string' && value.length > 0 && !path.isAbsolute(value)
  && !value.includes('\\') && value.split('/').every(part => part && part !== '.' && part !== '..');

// Checks package consistency. The manifest is not signed; this is not a sandbox.
export async function validateSuite(directory) {
  const root = path.resolve(directory);
  const errors = [];
  let manifest;
  try {
    manifest = JSON.parse(await fs.readFile(path.join(root, 'manifest.json'), 'utf8'));
    if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.files) || !manifest.files.length
      || !Array.isArray(manifest.testMatch) || !manifest.testMatch.length) throw Error('invalid shape');
  } catch { return { valid: false, errors: ['Invalid manifest'] }; }
  const seen = new Set();
  for (const file of manifest.files) {
    if (!safePath(file.path) || seen.has(file.path) || !/^[a-f0-9]{64}$/.test(file.sha256)) {
      errors.push('Invalid or duplicate manifest entry'); continue;
    }
    seen.add(file.path);
    const target = path.join(root, file.path);
    try {
      const real = await fs.realpath(target);
      if (!real.startsWith(root + path.sep) || (await fs.lstat(target)).isSymbolicLink()) {
        errors.push(`Unsafe path: ${file.path}`); continue;
      }
      const bytes = await fs.readFile(target);
      if (sha256(bytes) !== file.sha256) errors.push(`Hash mismatch: ${file.path}`);
      if (file.path.endsWith('.mjs')) {
        const imports = bytes.toString().matchAll(/(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g);
        for (const [, specifier] of imports) {
          if (!specifier.startsWith('.')) continue;
          const resolved = path.resolve(path.dirname(target), specifier);
          if (!resolved.startsWith(root + path.sep)) errors.push(`Import escapes suite: ${file.path}`);
          else if (!manifest.files.some(item => path.join(root, item.path) === resolved))
            errors.push(`Unlisted relative import: ${file.path}`);
        }
      }
    } catch { errors.push(`Missing file: ${file.path}`); }
  }
  for (const spec of manifest.testMatch) if (!safePath(spec) || !seen.has(spec) || !spec.endsWith('.spec.mjs'))
    errors.push('Invalid test selection');
  return { valid: errors.length === 0, errors };
}
