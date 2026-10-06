import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { IntlMessageFormat } from 'intl-messageformat';

type Dict = Record<string, string>;

export const SUPPORTED_LANGUAGES = ['en', 'fr', 'nl', 'de', 'es'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
const FALLBACK: Language = 'en';

/**
 * Loads flat ICU MessageFormat dictionaries from the repo-root locales/ and
 * each themes/<name>/locales/. Resolution order for a themed string:
 *   theme+lang → app+lang → theme+en → app+en → the key itself.
 */
@Injectable()
export class I18nService {
  private readonly logger = new Logger('I18n');
  private readonly app = new Map<string, Dict>();
  private readonly themes = new Map<string, Map<string, Dict>>();
  private readonly cache = new Map<string, IntlMessageFormat>();
  private readonly root = this.findRoot();

  constructor() {
    for (const lang of SUPPORTED_LANGUAGES) {
      const p = join(this.root, 'locales', `${lang}.json`);
      if (existsSync(p)) this.app.set(lang, this.read(p));
    }
    const themesDir = join(this.root, 'themes');
    for (const theme of ['generic', 'santa']) {
      const byLang = new Map<string, Dict>();
      for (const lang of SUPPORTED_LANGUAGES) {
        const p = join(themesDir, theme, 'locales', `${lang}.json`);
        if (existsSync(p)) byLang.set(lang, this.read(p));
      }
      if (byLang.size) this.themes.set(theme, byLang);
    }
    this.logger.log(`Loaded ${this.app.size} app locales.`);
  }

  isSupported(lang: string): lang is Language {
    return (SUPPORTED_LANGUAGES as readonly string[]).includes(lang);
  }

  /** Normalise an arbitrary language tag (e.g. "fr-BE") to a supported code. */
  normalize(lang: string | undefined | null): Language {
    if (!lang) return FALLBACK;
    const base = lang.toLowerCase().split('-')[0];
    return this.isSupported(base) ? base : FALLBACK;
  }

  /** Full app dictionary for a language, English as the fallback base (for the web client). */
  getMessages(lang: string): Record<string, string> {
    const l = this.normalize(lang);
    return { ...(this.app.get(FALLBACK) ?? {}), ...(this.app.get(l) ?? {}) };
  }

  t(
    key: string,
    opts: { lang?: string; theme?: string; vars?: Record<string, unknown> } = {},
  ): string {
    const lang = this.normalize(opts.lang);
    const raw = this.resolve(key, lang, opts.theme);
    if (raw === undefined) return key;
    const cacheKey = `${lang}:${opts.theme ?? ''}:${key}`;
    let fmt = this.cache.get(cacheKey);
    if (!fmt) {
      fmt = new IntlMessageFormat(raw, lang);
      this.cache.set(cacheKey, fmt);
    }
    return String(fmt.format(opts.vars ?? {}));
  }

  private resolve(key: string, lang: Language, theme?: string): string | undefined {
    const themeDict = theme ? this.themes.get(theme) : undefined;
    return (
      themeDict?.get(lang)?.[key] ??
      this.app.get(lang)?.[key] ??
      themeDict?.get(FALLBACK)?.[key] ??
      this.app.get(FALLBACK)?.[key]
    );
  }

  private read(path: string): Dict {
    return JSON.parse(readFileSync(path, 'utf8')) as Dict;
  }

  /** Walk up from cwd / this file to find the directory that holds locales/. */
  private findRoot(): string {
    const candidates = [process.cwd(), resolve(__dirname, '..', '..', '..', '..')];
    for (let base of candidates) {
      for (let i = 0; i < 6; i++) {
        if (existsSync(join(base, 'locales'))) return base;
        base = resolve(base, '..');
      }
    }
    return process.cwd();
  }
}
