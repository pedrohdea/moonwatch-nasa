// Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { key } = require('../site/shared/tablekit.js');

test('tablekit sort keys: ISO dates, en-US numbers, percent, text', () => {
  assert.ok(key('2025-01-01') > key('2024-12-31'));
  assert.ok(key('2024-04-10') > key('2024-04-09'));
  assert.equal(key('68,693'), 68693);
  assert.equal(key('1,234.56'), 1234.56);
  assert.equal(key('98%'), 98);
  assert.equal(key('-89.62'), -89.62);
  assert.equal(key('Crimson-Dawn'), 'crimson-dawn');
});
