// Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { key } = require('../site/shared/tablekit.js');

test('tablekit sort keys: dates, pt-BR numbers, percent, text', () => {
  assert.equal(key('10/04/2024'), 20240410);
  assert.ok(key('01/01/2025') > key('31/12/2024'));
  assert.equal(key('68.693'), 68693);
  assert.equal(key('1.234,56'), 1234.56);
  assert.equal(key('98%'), 98);
  assert.equal(key('-89,62'), -89.62);
  assert.equal(key('Crimson-Dawn'), 'crimson-dawn');
});
