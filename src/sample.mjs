import { canonicalHash } from './contracts.mjs';

export function sampleInput() {
  const plan = { schemaVersion: 1, createdAt: '2026-01-01T00:00:00Z', revision: 1, modelHash: 'synthetic-fixture-v1',
    scenarios: [{ id: 'status-check', type: 'integrity', steps: [{ id: 'read', assertionIds: ['status'] }],
      assertions: [{ id: 'status', kind: 'textEquals', afterStepId: 'read', target: { role: 'status' }, expected: 'Ready for review' }] }] };
  return { plan,
    approval: { schemaVersion: 1, planHash: canonicalHash(plan), planRevision: 1, approvedIds: ['status-check'], decisions: [] },
    verification: { planHash: canonicalHash(plan), scenarios: [{ scenarioId: 'status-check', status: 'verified' }] },
    generated: [{ scenarioId: 'status-check', source: `import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
test('synthetic status is ready', async ({ page }) => {
  const html = await fs.readFile(new URL('../../fixtures/page.html', import.meta.url), 'utf8');
  await page.setContent(html);
  await expect(page.getByRole('status')).toHaveText('Ready for review');
});
` }] };
}
