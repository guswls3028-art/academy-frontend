import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PassThrough, Readable } from 'node:stream';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ExcelJS = require('exceljs');
const excelRequire = createRequire(require.resolve('exceljs'));
const archiveRequire = createRequire(excelRequire.resolve('archiver'));
const zipRequire = createRequire(archiveRequire.resolve('zip-stream'));

test('archive glob consumers preserve recursive, brace, exclusion and Unicode matching', async t => {
  const tempRoot = path.resolve(os.tmpdir());
  const root = await fs.mkdtemp(path.join(tempRoot, 'academy-excel-deps-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(root)), tempRoot);
    assert.ok(path.basename(root).startsWith('academy-excel-deps-'));
    await fs.rm(root, { recursive: true, force: true });
  });
  await fs.mkdir(path.join(root, 'nested'));
  for (const file of ['학생.txt', 'sheet.xlsx', 'nested/score.txt', 'nested/skip.txt', '.hidden.txt']) {
    await fs.writeFile(path.join(root, file), 'synthetic');
  }
  for (const ownerRequire of [archiveRequire, zipRequire]) {
    const utilsRequire = createRequire(ownerRequire.resolve('archiver-utils'));
    const file = utilsRequire('./file');
    const actual = file.expand({ cwd: root }, ['**/*.{txt,xlsx}', '!**/skip.txt']).map(p => p.replaceAll('\\', '/')).sort();
    assert.deepEqual(actual, ['nested/score.txt', 'sheet.xlsx', '학생.txt']);
    assert.deepEqual(file.expand({ cwd: root }, ['missing-*.txt']), []);
  }
  const glob = archiveRequire('readdir-glob');
  const actual = await new Promise((resolve, reject) => {
    const names = [];
    glob(root, { pattern: '**/*.{txt,xlsx}', ignore: '**/skip.txt' })
      .on('match', entry => names.push(entry.relative.replaceAll('\\', '/')))
      .on('error', reject).on('end', () => resolve(names.sort()));
  });
  assert.deepEqual(actual, ['nested/score.txt', 'sheet.xlsx', '학생.txt']);
});

test('ExcelJS buffer roundtrip preserves Korean text, zero, dates, formulas and merges', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('합성 성적');
  sheet.addRow(['학생', '점수', '날짜']);
  sheet.addRow(['합성 학생', 0, new Date('2026-01-02T00:00:00Z')]);
  sheet.getCell('D2').value = { formula: 'B2+1', result: 1 };
  sheet.mergeCells('A4:C4'); sheet.getCell('A4').value = '합성 안내';
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(await workbook.xlsx.writeBuffer());
  const result = loaded.getWorksheet('합성 성적');
  assert.equal(result.getCell('A2').value, '합성 학생');
  assert.equal(result.getCell('B2').value, 0);
  assert.equal(result.getCell('C2').value.toISOString(), '2026-01-02T00:00:00.000Z');
  assert.deepEqual(result.getCell('D2').value, { formula: 'B2+1', result: 1 });
  assert.equal(result.getCell('B4').value, '합성 안내');
});

test('ExcelJS streaming ZIP writer and reader retain rows with upgraded unzipper', async () => {
  const stream = new PassThrough();
  const chunks = []; stream.on('data', chunk => chunks.push(chunk));
  const writer = new ExcelJS.stream.xlsx.WorkbookWriter({ stream, useSharedStrings: false });
  const sheet = writer.addWorksheet('합성 스트림');
  sheet.addRow(['학생', '점수']).commit(); sheet.addRow(['합성 학생', 0]).commit();
  sheet.commit(); await writer.commit();
  const buffer = Buffer.concat(chunks);
  assert.ok(buffer.length > 0);
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(Readable.from([buffer]), { sharedStrings: 'cache', worksheets: 'emit' });
  const rows = [];
  for await (const worksheet of reader) for await (const row of worksheet) rows.push(row.values.slice(1));
  assert.deepEqual(rows, [['학생', '점수'], ['합성 학생', 0]]);
});

test('invalid ZIP input is rejected by both workbook and archive readers', { timeout: 5000 }, async () => {
  const invalid = Buffer.from('synthetic invalid archive');
  await assert.rejects(new ExcelJS.Workbook().xlsx.load(invalid));
  await assert.rejects(excelRequire('unzipper').Open.buffer(invalid));
});
