import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Sequelize } from '@sequelize/core';
import { SEQUELIZE } from '../database/database.module';
import { CONFIG, type AppConfig } from '../config/env';
import {
  Assignment,
  Edition,
  Group,
  Membership,
  Participant,
  Thread,
  User,
} from '../database/models';
import { BadRequestException } from '@nestjs/common';
import { CryptoService } from '../crypto/crypto.service';
import { MailService } from '../mail/mail.service';
import { I18nService } from '../i18n/i18n.service';
import { AccessService } from '../groups/access.service';
import { AuthService } from '../auth/auth.service';
import type { SessionUser } from '../auth/auth.service';
import type { EditionSettingsDto } from './dto';
import { RateLimitService, DAY } from '../safety/rate-limit.service';
import { SuppressionService } from '../safety/suppression.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger('Admin');

  constructor(
    @Inject(SEQUELIZE) private readonly sequelize: Sequelize,
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly crypto: CryptoService,
    private readonly mail: MailService,
    private readonly i18n: I18nService,
    private readonly access: AccessService,
    private readonly auth: AuthService,
    private readonly rateLimit: RateLimitService,
    private readonly suppression: SuppressionService,
  ) {}

  // ─── Typed invitations (E2) ───────────────────────────────────────────

  async typedInvite(editionId: string, admin: SessionUser, firstName: string, rawEmail: string) {
    const ctx = await this.access.getEditionContext(editionId, admin.id);
    await this.access.requireAdmin(ctx.group.id, admin.id);
    if (ctx.edition.state !== 'open') throw new ConflictException('entries_closed');
    const email = rawEmail.trim().toLowerCase();

    await this.rateLimit.hit('typed_invite', admin.id, this.config.rateLimits.invitesPerAccount, DAY);

    // Typed invitations to a suppressed address are silently skipped.
    if (await this.suppression.isSuppressed(email)) {
      return { skipped: true as const };
    }

    const existingUser = await User.findOne({ where: { email } });

    // Avoid duplicate participants for the same person/email in this edition.
    const dupe = await Participant.findOne({
      where: existingUser
        ? { editionId, userId: existingUser.id }
        : { editionId, invitedEmail: email },
    });
    if (dupe) throw new ConflictException('already_invited');

    const participant = await Participant.create({
      editionId,
      userId: existingUser?.id ?? null,
      invitedEmail: email,
      invitedFirstName: firstName.trim(),
      status: 'invited',
    });
    if (existingUser) {
      await Membership.findOrCreate({
        where: { groupId: ctx.group.id, userId: existingUser.id },
        defaults: { groupId: ctx.group.id, userId: existingUser.id, role: 'member' },
      });
    }

    const link = await this.auth.createActionLink(email, `/editions/${editionId}`);
    const unsubscribeUrl = `${this.config.appUrl}/unsubscribe/${this.suppression.hashFor(email)}`;
    const lang = this.i18n.normalize(existingUser?.language ?? ctx.group.defaultLanguage);
    try {
      await this.mail.sendInvitation(
        email,
        admin.firstName ?? 'A friend',
        ctx.edition.name,
        link,
        unsubscribeUrl,
        lang,
      );
    } catch (err) {
      this.logger.error(`invitation email failed: ${(err as Error).message}`);
    }
    return { participantId: participant.id };
  }

  async resend(editionId: string, participantId: string, admin: SessionUser) {
    const ctx = await this.access.getEditionContext(editionId, admin.id);
    await this.access.requireAdmin(ctx.group.id, admin.id);
    const p = await Participant.findOne({ where: { id: participantId, editionId } });
    if (!p) throw new NotFoundException();
    const u = p.userId ? await User.findByPk(p.userId) : null;
    const to = u?.email ?? p.invitedEmail;
    if (!to) throw new ConflictException('no_address');
    const lang = this.i18n.normalize(u?.language ?? ctx.group.defaultLanguage);
    const editionLink = `${this.config.appUrl}/editions/${editionId}`;

    await this.rateLimit.hit('resend', participantId, this.config.rateLimits.resendsPerParticipant, DAY);

    try {
      if (ctx.edition.state === 'open' && p.status === 'invited') {
        const link = await this.auth.createActionLink(to, `/editions/${editionId}`);
        const unsub = `${this.config.appUrl}/unsubscribe/${this.suppression.hashFor(to)}`;
        await this.mail.sendInvitation(to, admin.firstName ?? 'A friend', ctx.edition.name, link, unsub, lang);
      } else if (ctx.edition.state !== 'open') {
        await this.mail.sendDrawReady(to, editionLink, lang, ctx.edition.theme);
      } else {
        await this.mail.sendNewEdition(to, ctx.edition.name, editionLink, lang, ctx.edition.theme);
      }
    } catch (err) {
      this.logger.error(`resend failed: ${(err as Error).message}`);
    }
    return { ok: true as const };
  }

  // ─── Remove participant (+ departure repair) ──────────────────────────

  async removeParticipant(editionId: string, participantId: string, admin: SessionUser) {
    const ctx = await this.access.getEditionContext(editionId, admin.id);
    await this.access.requireAdmin(ctx.group.id, admin.id);
    const leaver = await Participant.findOne({ where: { id: participantId, editionId } });
    if (!leaver) throw new NotFoundException();
    return this.applyRemoval(ctx.edition, leaver);
  }

  /**
   * Remove a participant from an edition, running the departure repair when the
   * draw has already happened. Used by admin removal and by self-leave / account
   * deletion, so it takes no admin context of its own.
   */
  async applyRemoval(edition: Edition, leaver: Participant) {
    const editionId = edition.id;
    if (edition.state === 'open') {
      await leaver.destroy();
      return { changed: 0, warnSmall: false };
    }

    // Drawn: departure repair. The leaver's giver takes over the leaver's
    // recipient; exactly one assignment row changes.
    const assignments = await Assignment.findAll({ where: { editionId } });
    const decrypted = assignments.map((a) => ({
      a,
      recipientId: this.crypto.decrypt(a.recipientCiphertext, a.nonce),
    }));

    const leaverRow = decrypted.find((d) => d.a.giverParticipantId === leaver.id);
    const giverRow = decrypted.find((d) => d.recipientId === leaver.id);
    const newRecipientId = leaverRow?.recipientId;

    let inheritingGiver: Participant | null = null;
    await this.sequelize.transaction(async (tx) => {
      if (giverRow && newRecipientId) {
        // X (giver of leaver) now gives to R (leaver's recipient).
        const sealed = this.crypto.encrypt(newRecipientId);
        giverRow.a.recipientCiphertext = sealed.ciphertext;
        giverRow.a.nonce = sealed.nonce;
        await giverRow.a.save({ transaction: tx });
        inheritingGiver = await Participant.findByPk(giverRow.a.giverParticipantId, { transaction: tx });
      }
      if (leaverRow) await leaverRow.a.destroy({ transaction: tx });
      // Delete the thread where the leaver was the recipient; the leaver's former
      // recipient keeps their thread, inherited by the new giver with its history.
      await Thread.destroy({ where: { editionId, recipientParticipantId: leaver.id }, transaction: tx });
      await leaver.destroy({ transaction: tx });

      if (inheritingGiver) {
        (inheritingGiver as Participant).drawChanged = true;
        await (inheritingGiver as Participant).save({ transaction: tx });
      }
    });

    // Only the inheriting giver is told (E5).
    if (inheritingGiver) {
      const giver = inheritingGiver as Participant;
      const u = giver.userId ? await User.findByPk(giver.userId) : null;
      if (u?.email) {
        const lang = this.i18n.normalize(u.language);
        try {
          await this.mail.sendDrawChanged(u.email, `${this.config.appUrl}/editions/${editionId}`, lang, edition.theme);
        } catch (err) {
          this.logger.error(`E5 failed: ${(err as Error).message}`);
        }
      }
    }

    const remaining = await Participant.count({ where: { editionId } });
    return { changed: inheritingGiver ? 1 : 0, warnSmall: remaining < 3 };
  }

  // ─── Admins ───────────────────────────────────────────────────────────

  async setRole(groupId: string, targetUserId: string, role: 'member' | 'admin', admin: SessionUser) {
    await this.access.requireAdmin(groupId, admin.id);
    const membership = await Membership.findOne({ where: { groupId, userId: targetUserId } });
    if (!membership) throw new NotFoundException();

    if (role === 'member' && membership.role === 'admin') {
      const adminCount = await Membership.count({ where: { groupId, role: 'admin' } });
      if (adminCount <= 1) throw new ConflictException('name_a_successor_first');
    }
    membership.role = role;
    await membership.save();
    return { ok: true as const };
  }

  // ─── Edition settings ─────────────────────────────────────────────────

  async updateEditionSettings(editionId: string, admin: SessionUser, dto: EditionSettingsDto) {
    const ctx = await this.access.getEditionContext(editionId, admin.id);
    await this.access.requireAdmin(ctx.group.id, admin.id);
    const e = ctx.edition;
    if (e.state === 'archived') throw new ConflictException('archived');

    if (dto.name !== undefined) e.name = dto.name.trim();
    if (dto.exchangeDate !== undefined) e.exchangeDate = dto.exchangeDate;
    if (dto.timezone !== undefined) e.timezone = dto.timezone;
    if (dto.budgetAmount !== undefined) e.budgetAmount = dto.budgetAmount;
    if (dto.budgetCurrency !== undefined) e.budgetCurrency = dto.budgetCurrency;
    if (dto.theme !== undefined) {
      // The theme is locked once aliases are in use (i.e. after the draw).
      if (e.state !== 'open') throw new ConflictException('theme_locked');
      e.theme = dto.theme;
    }
    await e.save();
    return { ok: true as const };
  }

  /** Delete a group (admin), after the admin re-types its name. Cascades. */
  async deleteGroup(groupId: string, admin: SessionUser, confirmName: string) {
    await this.access.requireAdmin(groupId, admin.id);
    const group = await Group.findByPk(groupId);
    if (!group) throw new NotFoundException();
    if (confirmName.trim() !== group.name) throw new BadRequestException('name_mismatch');
    await group.destroy(); // cascades editions → participants → content
    return { ok: true as const };
  }

  async archiveEdition(editionId: string, admin: SessionUser) {
    const ctx = await this.access.getEditionContext(editionId, admin.id);
    await this.access.requireAdmin(ctx.group.id, admin.id);
    ctx.edition.state = 'archived';
    ctx.edition.archivedAt = new Date();
    await ctx.edition.save();
    return { ok: true as const };
  }
}
