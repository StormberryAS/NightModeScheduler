// The build: the committed app.js is what ts/app.ts compiles to, the generated first-run notice
// (gate.js, gate.css) is untouched, and the only JavaScript in the repository is the compiled
// app.js and the generated gate.js, each marked for GitHub's language bar (Marcos, 2026-10-17: no
// hand-written JavaScript).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const COMPILED = ['app.js'];
const GENERATED = ['gate.js'];

/** The first-run notice as build-gates.py (at the root of the GitHub folder) last wrote it here,
    on 6 November 2026 (gate.js compiled by tsc from the script's TypeScript template; gate.css
    unchanged since 2 October 2026). Only that script changes these files; when it does, update
    the hashes in the same commit. */
const GATE_SHA256: Record<string, string> = {
  'gate.js': '340068836137094e3429ebef4126224e60ebb6fa4fd467913fc7c90d4c3f92b1',
  'gate.css': 'df00448f893315714e1808a703b096efda68d1f168ca68f96b5fb463c30b68fb',
};

const sha256 = (path: string): string => createHash('sha256').update(readFileSync(`${root}${path}`)).digest('hex');

test('tools/build-ts.sh --check passes: app.js equals a fresh compile', () => {
  const out = execFileSync(`${root}tools/build-ts.sh`, ['--check'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.match(out, /^build-ts: app\.js matches ts\/app\.ts$/m);
  assert.match(out, /^build-ts: check passed$/m);
});

test('the generated first-run notice is byte for byte what build-gates.py wrote', () => {
  for (const [f, want] of Object.entries(GATE_SHA256)) assert.equal(sha256(f), want, f);
  assert.match(readFileSync(`${root}gate.js`, 'utf8'), /^"use strict";\n\/\*! STORMBERRY FIRST-RUN GATE \(behaviour\)\. NightModeScheduler, dismissible tier\.\n {4}GENERATED FILE: build-gates\.py /);
});

test('index.html loads app.js as before: a classic script at the end of the body, after gate.js', () => {
  const page = readFileSync(`${root}index.html`, 'utf8');
  const tags = [...page.matchAll(/<script\b[^>]*>/g)].map((m) => m[0].replace(/\?v=[0-9a-f]{8}/, '?v=STAMP'));
  assert.deepEqual(tags, ['<script src="gate.js?v=STAMP" defer>', '<script src="app.js?v=STAMP">']);
  assert.ok(page.indexOf('src="app.js') > page.lastIndexOf('</main>'));
});

test('the only JavaScript is compiled or generated output, each file marked so', (t) => {
  const git = (...args: string[]): string => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  let inGit = false;
  try { inGit = git('rev-parse', '--is-inside-work-tree').trim() === 'true'; } catch { inGit = false; }
  if (!inGit) { t.skip('not a git checkout'); return; }
  const js = git('ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '*.js', '*.mjs', '*.cjs').split('\0').filter(Boolean);
  assert.deepEqual([...new Set(js)].sort(), [...COMPILED, ...GENERATED].sort());
  for (const f of [...COMPILED, ...GENERATED]) assert.equal(git('check-attr', 'linguist-generated', '--', f).trim(), `${f}: linguist-generated: true`);
});
