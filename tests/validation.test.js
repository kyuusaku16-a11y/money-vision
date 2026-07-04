import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveValidation } from '../src/validation.js';

test('deriveValidation: 余剰内なら警告なし・上限は余剰/12', () => {
  const v = deriveValidation({ annualIncome: 5000000, annualExpense: 3000000, monthlyInvest: 50000 });
  assert.equal(v.surplus, 2000000);
  assert.equal(v.investCapMonthly, 166666);
  assert.equal(v.overInvest, false);
  assert.equal(v.message, null);
});

test('deriveValidation: 投資×12が余剰超過なら責めない警告を返す', () => {
  const v = deriveValidation({ annualIncome: 5000000, annualExpense: 3000000, monthlyInvest: 200000 });
  assert.equal(v.overInvest, true);
  assert.ok(typeof v.message === 'string' && v.message.includes('投資額'));
  assert.ok(!v.message.includes('危険') && !v.message.includes('不可能'));
});

test('deriveValidation: 余剰マイナスでも投資0なら警告しない・上限0', () => {
  const v = deriveValidation({ annualIncome: 2000000, annualExpense: 3000000, monthlyInvest: 0 });
  assert.equal(v.overInvest, false);
  assert.equal(v.investCapMonthly, 0);
});

test('deriveValidation: 余剰マイナスで投資ありなら警告する', () => {
  const v = deriveValidation({ annualIncome: 2000000, annualExpense: 3000000, monthlyInvest: 10000 });
  assert.equal(v.overInvest, true);
});

test('deriveValidation: 年収0なら incomeNotice を返す（責めないトーン）', () => {
  const v = deriveValidation({ annualIncome: 0, annualExpense: 3000000, monthlyInvest: 0 });
  assert.ok(typeof v.incomeNotice === 'string' && v.incomeNotice.includes('年収0円'));
});

test('deriveValidation: 年収があれば incomeNotice は null', () => {
  const v = deriveValidation({ annualIncome: 5000000, annualExpense: 3000000, monthlyInvest: 0 });
  assert.equal(v.incomeNotice, null);
});
