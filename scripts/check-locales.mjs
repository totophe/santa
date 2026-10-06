#!/usr/bin/env node
// Fails on a missing or orphan key in any language, against English as the
// source of truth. Checks the root locales/ and every themes/<name>/locales/.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = ['en', 'fr', 'nl', 'de', 'es'];
let failed = false;

function load(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function checkDir(dir, { optionalLangs = [] } = {}) {
  const enPath = join(dir, 'en.json');
  if (!existsSync(enPath)) return;
  const en = load(enPath);
  const enKeys = new Set(Object.keys(en));
  for (const lang of LANGS) {
    if (lang === 'en') continue;
    const p = join(dir, `${lang}.json`);
    if (!existsSync(p)) {
      if (!optionalLangs.includes(lang)) {
        console.error(`✗ ${p} is missing`);
        failed = true;
      }
      continue;
    }
    const data = load(p);
    const keys = new Set(Object.keys(data));
    for (const k of enKeys) {
      if (!keys.has(k)) {
        console.error(`✗ ${lang}: missing key "${k}" (in ${dir})`);
        failed = true;
      }
    }
    for (const k of keys) {
      if (!enKeys.has(k)) {
        console.error(`✗ ${lang}: orphan key "${k}" (in ${dir})`);
        failed = true;
      }
    }
  }
}

// Root app locales: only en + fr ship in v1; nl/de/es are optional for now.
checkDir(join(root, 'locales'), { optionalLangs: ['nl', 'de', 'es'] });

// Theme locales.
const themesDir = join(root, 'themes');
if (existsSync(themesDir)) {
  for (const theme of readdirSync(themesDir)) {
    const localesDir = join(themesDir, theme, 'locales');
    if (existsSync(localesDir)) {
      checkDir(localesDir, { optionalLangs: ['nl', 'de', 'es'] });
    }
  }
}

if (failed) {
  console.error('\nLocale check failed.');
  process.exit(1);
}
console.log('✓ Locale keys are consistent.');
