// The page logic: the compiled app.js runs in a Node vm (tests/vm-page.ts) with a stub of the page
// parts it touches, a fixed clock, locale and time zone, a Map for localStorage, an IndexedDB in
// memory and Node's Web Crypto. Every expected value below is what the JavaScript before the move to
// TypeScript (997c2f6) gave in the same harness; the encrypted backup was made by that JavaScript.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPage, fileInputValue, type Page } from './vm-page.ts';

const NOW = Date.parse('2026-11-05T21:30:00Z');
const GB = { now: NOW, locale: 'en-GB', timeZone: 'Europe/Oslo' };
const NO_LOGS = ['<li class="log-item"><span class="log-date">No logs yet.</span></li>'];
const RULE_GB = 'Estimate from a fixed rule, not a measurement: 22:00 plus 20 minutes for each hour of screen time after 18:00.';

/** Two logs (3 Nov 4.5 h, 2 Nov 1 h), exported with the password "Nattmodus 2026" by the old app.js. */
const OLD_BACKUP = '{"encrypted":true,"data":"2gUWmEju0tpJdcahju7iHgkwWtsGt02alzbtqozpkXq48AzJ10giJ0oqyg/L5sALY0rsbo/kYh31w4Vmwetuzw7wHd3WoxNp3wnHhma1Yo/6RFuvXTyQxMMyy8W1a056V++UxRuIT2v9ujjtz45RGhtNz2Q3o458AVG5iKWVNtXEmLnZUVDDEq2OSI4FBJFh1LRAPxhR1IGth/3mfFE6+VZEG+dvPUk="}';

/** A value of the page's realm as plain data of this one (deepEqual compares prototypes too). */
const copy = (v: unknown): unknown => JSON.parse(JSON.stringify(v)) as unknown;
const logs = async (p: Page): Promise<unknown> => copy(await (p.run('readLogs()') as Promise<unknown>));

/** Hands a backup to the import and waits until the file input is reset. */
async function importFile(p: Page, text: string, answer?: string | null): Promise<string[]> {
  const before = p.alerts.length;
  if (answer !== undefined) p.answers.push(answer);
  p.chooseFile('backup.json', text);
  await p.until(() => fileInputValue(p) === '', 'the import to finish');
  return p.alerts.slice(before);
}

test('the bedtime rule: 22:00 plus 20 minutes per hour, wrapped past midnight, in the visitor\'s clock format', async () => {
  const p = loadPage(GB);
  assert.deepEqual(copy(p.run('[-1, 0, 0.4, 0.5, 1439, 1439.5, 1440, 2880, -1441].map(wrapMinutes)')), [1439, 0, 0, 1, 1439, 0, 0, 0, 1439]);
  assert.deepEqual(copy(p.run('[0, 2, 3.5, 5.5, 6, 7.5, 0.025].map((h) => [estimateBedtimeMinutes(h), formatTime(estimateBedtimeMinutes(h)), formatHours(h)])')), [
    [1320, '22:00', '0.0 hrs'], [1360, '22:40', '2.0 hrs'], [1390, '23:10', '3.5 hrs'], [1430, '23:50', '5.5 hrs'],
    [0, '00:00', '6.0 hrs'], [30, '00:30', '7.5 hrs'], [1321, '22:01', '0.0 hrs'],
  ]);
  assert.equal(p.run('describeRule()'), RULE_GB);
  await p.ready();
  assert.equal(p.text('evening-start'), '18:00');
  assert.equal(p.text('bedtime-desc'), RULE_GB);
  assert.equal(p.text('exposure-val'), '2.0 hrs');
  assert.equal(p.text('bedtime-val'), '22:40');
  assert.deepEqual(p.rootStyle(), { '--bg-hue': '153.33333333333334' });
  assert.deepEqual(p.list(), NO_LOGS);
  assert.deepEqual([...p.storage.keys()], [], 'nothing stored on a first visit');
  for (const [v, val, bed, hue] of [['6', '6.0 hrs', '00:00', '20'], ['0', '0.0 hrs', '22:00', '220'], ['0.5', '0.5 hrs', '22:10', '203.33333333333334']]) {
    p.slide(v ?? '');
    assert.deepEqual([p.text('exposure-val'), p.text('bedtime-val'), p.rootStyle()['--bg-hue']], [val, bed, hue]);
  }

  const us = loadPage({ now: NOW, locale: 'en-US', timeZone: 'America/New_York' });
  await us.ready();
  us.slide('6');
  assert.deepEqual([us.text('evening-start'), us.text('bedtime-val')], ['6:00 PM', '12:00 AM']);
  assert.equal(us.text('bedtime-desc'), 'Estimate from a fixed rule, not a measurement: 10:00 PM plus 20 minutes for each hour of screen time after 6:00 PM.');
});

test('a saved log is encrypted at rest with a non-extractable device key and listed newest first', async () => {
  const p = loadPage(GB);
  await p.ready();
  p.slide('3.5');
  await (p.press('save-log-btn') as Promise<void>);
  assert.deepEqual(p.button('save-log-btn'), { text: 'Logged', background: '#00ff64' });
  assert.deepEqual(p.runTimers(), [2000]);
  assert.deepEqual(p.button('save-log-btn'), { text: "Log today's screen time", background: 'var(--accent-primary)' });
  p.slide('6');
  await (p.press('save-log-btn') as Promise<void>);

  assert.deepEqual([...p.storage.keys()], ['nightmode_logs_v2']);
  const blob = p.storage.get('nightmode_logs_v2') ?? '';
  assert.equal(blob.length, 200, '12 bytes of IV, the JSON, 16 bytes of tag, in base64');
  assert.ok(!atob(blob).includes('hours'), 'no plaintext in localStorage');
  const key = p.idb.get('logKey');
  assert.ok(key instanceof CryptoKey);
  assert.deepEqual([key.type, key.extractable, key.algorithm, [...key.usages].sort()], ['secret', false, { name: 'AES-GCM', length: 256 }, ['decrypt', 'encrypt']]);
  assert.deepEqual(await logs(p), [
    { timestamp: NOW, hours: 6, bedtimeMinutes: 0 },
    { timestamp: NOW, hours: 3.5, bedtimeMinutes: 1390 },
  ]);
  assert.deepEqual(p.list(), ['log-item: log-date 5 Nov 2026 | log-data 6.0 hrs (00:00)', 'log-item: log-date 5 Nov 2026 | log-data 3.5 hrs (23:10)']);

  const many = loadPage(GB);
  await many.ready();
  for (let i = 0; i < 12; i++) { many.slide(String(i % 7)); await (many.press('save-log-btn') as Promise<void>); }
  assert.equal(many.list().length, 10, 'the list shows the ten newest');
  assert.equal(many.list()[0], 'log-item: log-date 5 Nov 2026 | log-data 4.0 hrs (23:20)');
  assert.equal(((await logs(many)) as unknown[]).length, 12);
});

test('logs from before the encryption are migrated once, and bad entries are skipped', async () => {
  const legacy = JSON.stringify([
    { timestamp: Date.parse('2026-09-20T20:00:00Z'), hours: 6, bedtime: '12:00 PM' },
    { timestamp: Date.parse('2026-09-19T20:00:00Z'), hours: 'x' },
    null,
    { timestamp: Date.parse('2026-09-18T20:00:00Z'), hours: 1.5, bedtimeMinutes: 1350 },
    { timestamp: 'not a date', hours: 2 },
  ]);
  const p = loadPage({ ...GB, storage: { nightmode_logs: legacy } });
  await p.ready();
  assert.deepEqual([...p.storage.keys()], ['nightmode_logs_v2'], 'the plaintext is gone once the ciphertext is written');
  assert.deepEqual(await logs(p), JSON.parse(legacy));
  assert.deepEqual(p.list(), [
    'log-item: log-date 20 Sept 2026 | log-data 6.0 hrs (00:00)',
    'log-item: log-date 18 Sept 2026 | log-data 1.5 hrs (22:30)',
    'log-item: log-date Invalid Date | log-data 2.0 hrs (22:40)',
  ]);
});

test('export: a plain or a password backup, as before; import: the old app\'s backup and every failure', async () => {
  const p = loadPage(GB);
  await p.ready();
  p.slide('3.5');
  await (p.press('save-log-btn') as Promise<void>);
  p.slide('6');
  await (p.press('save-log-btn') as Promise<void>);

  p.answers.push('', 'Nattmodus 2026', null);
  for (let i = 0; i < 3; i++) await (p.press('export-btn') as Promise<void>);
  assert.deepEqual(p.prompts, Array(3).fill('Enter a password to encrypt the backup, or leave empty for an unencrypted file:'));
  assert.deepEqual(p.clicks, Array(2).fill('download nightmode_logs_2026-11-05.json'), 'Cancel downloads nothing');
  assert.equal(p.downloads[0], '{"encrypted":false,"data":"W3sidGltZXN0YW1wIjoxNzkzOTE0MjAwMDAwLCJob3VycyI6NiwiYmVkdGltZU1pbnV0ZXMiOjB9LHsidGltZXN0YW1wIjoxNzkzOTE0MjAwMDAwLCJob3VycyI6My41LCJiZWR0aW1lTWludXRlcyI6MTM5MH1d"}');
  const sealed = p.downloads[1] ?? '';
  assert.equal((JSON.parse(sealed) as { data: string }).data.length, 220);
  assert.equal(await (p.run(`decryptData(${JSON.stringify(sealed)}, 'Nattmodus 2026')`) as Promise<string>),
    '[{"timestamp":1793914200000,"hours":6,"bedtimeMinutes":0},{"timestamp":1793914200000,"hours":3.5,"bedtimeMinutes":1390}]');
  assert.equal(await (p.run(`decryptData(${JSON.stringify(sealed)}, 'wrong').then(() => 'resolved', (e) => e.name)`) as Promise<string>), 'OperationError');
  assert.equal(await (p.run(`decryptData(${JSON.stringify(sealed)}, null).then(() => 'resolved', (e) => e.message)`) as Promise<string>), 'Password required');

  p.press('import-btn');
  assert.equal(p.clicks.at(-1), 'click #import-file', 'Import opens the file chooser');
  const ask = 'This backup is encrypted. Please enter the password to decrypt:';
  p.prompts.length = 0;
  assert.deepEqual(await importFile(p, OLD_BACKUP, 'Nattmodus 2026'), ['Logs imported successfully!']);
  assert.deepEqual(p.prompts, [ask]);
  assert.deepEqual(p.list(), ['log-item: log-date 3 Nov 2026 | log-data 4.5 hrs (23:30)', 'log-item: log-date 2 Nov 2026 | log-data 1.0 hrs (22:20)']);
  const imported = await logs(p);
  assert.deepEqual(await importFile(p, OLD_BACKUP, 'Nattmodus 2025'), ['Error reading file or incorrect password.']);
  assert.deepEqual(await importFile(p, OLD_BACKUP, null), [], 'Cancel at the password: no message, nothing changed');
  assert.deepEqual(await importFile(p, JSON.stringify({ encrypted: false, data: btoa('{"a":1}') })), ['Invalid log format. Must be a JSON array.']);
  assert.deepEqual(await importFile(p, 'not json'), ['Error reading file or incorrect password.']);
  assert.deepEqual(await importFile(p, 'null'), ['Error reading file or incorrect password.']);
  assert.deepEqual(await logs(p), imported, 'a failed import changes nothing');
  assert.deepEqual(await importFile(p, p.downloads[0] ?? ''), ['Logs imported successfully!']);
  assert.deepEqual(p.list(), ['log-item: log-date 5 Nov 2026 | log-data 6.0 hrs (00:00)', 'log-item: log-date 5 Nov 2026 | log-data 3.5 hrs (23:10)']);
});
