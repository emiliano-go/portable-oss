import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ago, compactNumber, fullNumber } from '../src/lib/format.ts';

test('compactNumber shortens large values', () => {
  assert.equal(compactNumber.format(999), '999');
  assert.equal(compactNumber.format(1500), '1.5K');
  assert.equal(compactNumber.format(2_300_000), '2.3M');
});

test('fullNumber keeps exact digits', () => {
  assert.equal(fullNumber.format(1234567), '1,234,567');
});

test('ago renders relative windows', () => {
  const now = Date.now();
  assert.equal(ago(new Date(now - 30_000).toISOString()), 'just now');
  assert.equal(ago(new Date(now - 5 * 60_000).toISOString()), '5m ago');
  assert.equal(ago(new Date(now - 3 * 3_600_000).toISOString()), '3h ago');
  assert.equal(ago(new Date(now - 2 * 86_400_000).toISOString()), '2d ago');
});

test('ago tolerates missing and future dates', () => {
  assert.equal(ago(null), '');
  assert.equal(ago(new Date(Date.now() + 60_000).toISOString()), '');
});
