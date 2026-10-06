import { Controller, Get, Inject } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { CONFIG, type AppConfig } from '../config/env';

const BUILTIN = `# Privacy

Santa is an app for secret gift exchanges. We keep as little as possible.

## What we store
Your email address, your display name and optional last name, your language, the
groups and editions you take part in, and the wishlists and messages you write.

## The draw
Who gives to whom is encrypted with a key kept outside the database. Nobody —
not admins, not instance admins — can see a pairing other than their own. Whoever
holds both the database and the encryption key could decrypt the draw; the goal
is to make peeking impossible by accident, not to resist a determined host.

## Email
We send email only when action is needed (sign-in, invitations, the draw, the
chat opening, wishlist reminders). Messages never trigger an email. No tracking
pixels, no link redirection.

## Your choices
You can edit or delete your account at any time. Deleting your account removes
your sessions and wishlists and leaves your groups.
`;

@Controller('privacy')
export class PrivacyController {
  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}

  @Get()
  get(): { markdown: string } {
    const path = this.config.privacyPagePath;
    if (path && existsSync(path)) {
      try {
        return { markdown: readFileSync(path, 'utf8') };
      } catch {
        /* fall through to built-in */
      }
    }
    return { markdown: BUILTIN };
  }
}
