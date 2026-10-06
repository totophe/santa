import { Injectable, Logger } from '@nestjs/common';
import { Op } from '@sequelize/core';
import {
  Edition,
  LoginToken,
  Membership,
  Participant,
  Session,
  User,
} from '../database/models';
import { MailService } from '../mail/mail.service';
import { I18nService } from '../i18n/i18n.service';
import { CONFIG, type AppConfig } from '../config/env';
import { Inject } from '@nestjs/common';
import {
  hashToken,
  hashesEqual,
  randomUrlToken,
  sixDigitCode,
} from './tokens';

const CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const ACTION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SESSION_TTL_MS = 183 * 24 * 60 * 60 * 1000; // ~6 months
const MAX_ATTEMPTS = 5;

export interface SessionUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  language: string;
  profileComplete: boolean;
}

export interface VerifyResult {
  sessionToken: string;
  persistent: boolean;
  user: SessionUser;
  target: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');

  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly mail: MailService,
    private readonly i18n: I18nService,
  ) {}

  /**
   * Issue a sign-in email (E1). Behaves identically whether or not the address
   * has an account — the response must never reveal account existence.
   */
  async requestSignIn(rawEmail: string, target: string | null): Promise<void> {
    const email = rawEmail.trim().toLowerCase();
    const code = sixDigitCode();
    const linkToken = randomUrlToken();

    await LoginToken.create({
      email,
      codeHash: hashToken(code),
      linkTokenHash: hashToken(linkToken),
      purpose: target ? 'action' : 'sign_in',
      target,
      expiresAt: new Date(Date.now() + (target ? ACTION_TTL_MS : CODE_TTL_MS)),
    });

    const existing = await User.findOne({ where: { email } });
    const lang = this.i18n.normalize(existing?.language ?? this.config.defaultLanguage);
    const link = `${this.config.appUrl}/api/auth/link?token=${encodeURIComponent(linkToken)}`;

    try {
      await this.mail.sendSignIn(email, code, link, lang);
    } catch (err) {
      // Never surface send failures to the caller (no enumeration, no detail).
      this.logger.error(`sign-in email failed for a request: ${(err as Error).message}`);
    }
  }

  /** Verify a 6-digit code and establish a session. Returns null on any failure. */
  async verifyCode(
    rawEmail: string,
    code: string,
    sharedDevice: boolean,
  ): Promise<VerifyResult | null> {
    const email = rawEmail.trim().toLowerCase();
    const token = await LoginToken.findOne({
      where: {
        email,
        usedAt: { [Op.is]: null },
        expiresAt: { [Op.gt]: new Date() },
      },
      order: [['createdAt', 'DESC']],
    });
    if (!token) return null;

    if (token.attempts >= MAX_ATTEMPTS) return null;

    if (!hashesEqual(token.codeHash, hashToken(code))) {
      token.attempts += 1;
      await token.save();
      return null;
    }

    token.usedAt = new Date();
    await token.save();
    return this.establish(email, token.target, sharedDevice);
  }

  /** Verify a magic-link / action token and establish a session. */
  async verifyLink(linkToken: string): Promise<VerifyResult | null> {
    const token = await LoginToken.findOne({
      where: {
        linkTokenHash: hashToken(linkToken),
        usedAt: { [Op.is]: null },
        expiresAt: { [Op.gt]: new Date() },
      },
      order: [['createdAt', 'DESC']],
    });
    if (!token) return null;

    token.usedAt = new Date();
    await token.save();
    // A link is single-use; it establishes a non-shared (persistent) session.
    return this.establish(token.email, token.target, false);
  }

  private async establish(
    email: string,
    target: string | null,
    sharedDevice: boolean,
  ): Promise<VerifyResult> {
    const [user] = await User.findOrCreate({
      where: { email },
      defaults: { email, language: this.config.defaultLanguage },
    });
    user.lastSeenAt = new Date();
    await user.save();

    // Link any typed invitations sent to this address: attach the account to
    // the invited participant row and add a group membership. Status stays
    // "invited" until the person accepts.
    await this.linkInvitations(email, user.id);

    const sessionToken = randomUrlToken();
    const persistent = !sharedDevice;
    await Session.create({
      userId: user.id,
      tokenHash: hashToken(sessionToken),
      persistent,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      lastUsedAt: new Date(),
    });

    return {
      sessionToken,
      persistent,
      target,
      user: this.toSessionUser(user),
    };
  }

  /** Resolve a session token to its user, rolling the expiry forward. */
  async resolveSession(sessionToken: string): Promise<SessionUser | null> {
    const session = await Session.findOne({
      where: {
        tokenHash: hashToken(sessionToken),
        expiresAt: { [Op.gt]: new Date() },
      },
    });
    if (!session) return null;

    session.lastUsedAt = new Date();
    session.expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await session.save();

    const user = await User.findByPk(session.userId);
    if (!user) return null;
    return this.toSessionUser(user);
  }

  /** Mint a single-use action link (valid 7 days) that signs in and lands on target. */
  async createActionLink(rawEmail: string, target: string): Promise<string> {
    const email = rawEmail.trim().toLowerCase();
    const linkToken = randomUrlToken();
    await LoginToken.create({
      email,
      codeHash: hashToken(randomUrlToken()), // unused code slot
      linkTokenHash: hashToken(linkToken),
      purpose: 'action',
      target,
      expiresAt: new Date(Date.now() + ACTION_TTL_MS),
    });
    return `${this.config.appUrl}/api/auth/link?token=${encodeURIComponent(linkToken)}`;
  }

  private async linkInvitations(email: string, userId: string): Promise<void> {
    const invited = await Participant.findAll({ where: { invitedEmail: email, userId: null } });
    for (const p of invited) {
      p.userId = userId;
      await p.save();
      const edition = await Edition.findByPk(p.editionId);
      if (edition) {
        await Membership.findOrCreate({
          where: { groupId: edition.groupId, userId },
          defaults: { groupId: edition.groupId, userId, role: 'member' },
        });
      }
    }
  }

  async signOut(sessionToken: string): Promise<void> {
    await Session.destroy({ where: { tokenHash: hashToken(sessionToken) } });
  }

  async updateProfile(
    userId: string,
    patch: { firstName?: string; lastName?: string | null; language?: string },
  ): Promise<SessionUser | null> {
    const user = await User.findByPk(userId);
    if (!user) return null;
    if (patch.firstName !== undefined) user.firstName = patch.firstName;
    if (patch.lastName !== undefined) user.lastName = patch.lastName;
    if (patch.language !== undefined) {
      user.language = this.i18n.normalize(patch.language);
    }
    await user.save();
    return this.toSessionUser(user);
  }

  private toSessionUser(user: User): SessionUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      language: user.language,
      profileComplete: !!user.firstName && user.firstName.trim().length > 0,
    };
  }
}
