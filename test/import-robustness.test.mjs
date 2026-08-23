import test from 'node:test';
import assert from 'node:assert/strict';

import { parseSpreadsheet } from '../src/lib/data/index.js';
import { validateTitle } from '../src/features/title/index.js';

test('parseSpreadsheet strips the UTF-8 BOM so the first header stays matchable', async () => {
  const csv = '\uFEFF商品ID,销售额\nSKU-1,129\nSKU-2,88';
  const [sheet] = await parseSpreadsheet(csv, { format: 'csv', name: '带BOM.csv' });
  assert.deepEqual(sheet.headers, ['商品ID', '销售额']);
  assert.equal(sheet.rows[0]['商品ID'], 'SKU-1');
  assert.equal(sheet.rows[1].销售额, '88');
});

test('validateTitle catches banned words written with Chinese commas', () => {
  const candidate = { text: 'Waterproof Guarantee Knit Top', language: 'en', factsUsed: ['knit top'] };
  const result = validateTitle(candidate, { facts: ['knit top'] }, { bannedWords: '防水，waterproof，guarantee' });
  assert.equal(result.valid, false);
  assert.deepEqual(result.checks.bannedWords.matches.sort(), ['guarantee', 'waterproof']);

  const ok = validateTitle({ text: 'Knit Top', language: 'en', factsUsed: ['knit top'] }, { facts: ['knit top'] }, { bannedWords: '防水，waterproof' });
  assert.equal(ok.valid, true);
});
