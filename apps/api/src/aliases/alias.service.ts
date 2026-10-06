import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomInt } from 'node:crypto';

interface AliasDef {
  key: string;
  emoji: string;
  name: Record<string, string>;
}

/** Loads per-theme alias pools and assigns unique ones to an edition's draw. */
@Injectable()
export class AliasService {
  private readonly logger = new Logger('Alias');
  private readonly root = this.findRoot();
  private readonly byTheme = new Map<string, AliasDef[]>();

  private load(theme: string): AliasDef[] {
    const cached = this.byTheme.get(theme);
    if (cached) return cached;
    const file = join(this.root, 'themes', theme, 'aliases.json');
    let defs: AliasDef[] = [];
    if (existsSync(file)) {
      try {
        defs = JSON.parse(readFileSync(file, 'utf8')) as AliasDef[];
      } catch (err) {
        this.logger.warn(`could not read aliases for ${theme}: ${(err as Error).message}`);
      }
    }
    this.byTheme.set(theme, defs);
    return defs;
  }

  /** Return `count` unique alias keys for a theme, shuffled (CSPRNG). */
  assign(theme: string, count: number): string[] {
    const keys = this.load(theme).map((a) => a.key);
    for (let i = keys.length - 1; i > 0; i--) {
      const j = randomInt(0, i + 1);
      [keys[i], keys[j]] = [keys[j], keys[i]];
    }
    if (keys.length < count) {
      // Should not happen (pools are sized above the member cap); fall back to
      // suffixed keys so the draw never fails for want of an alias.
      while (keys.length < count) keys.push(`alias-${keys.length}`);
    }
    return keys.slice(0, count);
  }

  display(theme: string, key: string, lang: string): { key: string; emoji: string; name: string } {
    const def = this.load(theme).find((a) => a.key === key);
    if (!def) return { key, emoji: '🎁', name: key };
    return { key, emoji: def.emoji, name: def.name[lang] ?? def.name.en ?? key };
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
