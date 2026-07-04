import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtMoney, manToYen, yenToMan } from '../src/format.js';

test('fmtMoney: 1億以上は X.XX億円', () => {
  assert.equal(fmtMoney(100000000), '1.00億円');
  assert.equal(fmtMoney(123450000), '1.23億円');
});

test('fmtMoney: 1億未満は 万円 表記', () => {
  assert.equal(fmtMoney(5000000), '500万円');
  assert.equal(fmtMoney(12345678), '1,235万円');
});

test('manToYen: 万円→円（小数入力も整数円へ）', () => {
  assert.equal(manToYen(500), 5000000);
  assert.equal(manToYen(7.5), 75000);
  assert.equal(manToYen('500'), 5000000);
});

test('yenToMan: 円→万円（小数1桁）と往復整合', () => {
  assert.equal(yenToMan(5000000), 500);
  assert.equal(yenToMan(75000), 7.5);
  assert.equal(manToYen(yenToMan(75000)), 75000);
});
