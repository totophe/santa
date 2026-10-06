import { Inject, Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CONFIG, type AppConfig } from '../config/env';
import { SUPPORTED_LANGUAGES } from '../i18n/i18n.service';

export interface ThemeInfo {
  name: string;
  label: string;
  defaultEditionNamePattern: string;
  palette: { light: Record<string, string>; dark: Record<string, string> };
  pattern: string;
}

export interface PublicMeta {
  instanceName: string;
  defaultLanguage: string;
  languages: string[];
  // Whether a visitor may create a group without an invite (landing page CTA).
  groupCreationOpen: boolean;
  themes: ThemeInfo[];
}

/** Public, unauthenticated configuration the web shell needs to render. */
@Injectable()
export class MetaService {
  private readonly logger = new Logger('Meta');
  private readonly root = this.findRoot();
  private readonly themes = this.loadThemes();

  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}

  getPublicMeta(): PublicMeta {
    return {
      instanceName: this.config.instanceName,
      defaultLanguage: this.config.defaultLanguage,
      languages: [...SUPPORTED_LANGUAGES],
      groupCreationOpen: this.config.groupCreation === 'open',
      themes: this.themes,
    };
  }

  private loadThemes(): ThemeInfo[] {
    const dir = join(this.root, 'themes');
    if (!existsSync(dir)) return [];
    const themes: ThemeInfo[] = [];
    for (const name of readdirSync(dir)) {
      const file = join(dir, name, 'theme.json');
      if (!existsSync(file)) continue;
      try {
        themes.push(JSON.parse(readFileSync(file, 'utf8')) as ThemeInfo);
      } catch (err) {
        this.logger.warn(`could not read theme ${name}: ${(err as Error).message}`);
      }
    }
    return themes;
  }

  private findRoot(): string {
    const candidates = [process.cwd(), resolve(__dirname, '..', '..', '..', '..')];
    for (let base of candidates) {
      for (let i = 0; i < 6; i++) {
        if (existsSync(join(base, 'themes'))) return base;
        base = resolve(base, '..');
      }
    }
    return process.cwd();
  }
}
