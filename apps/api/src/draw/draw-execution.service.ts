import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Sequelize, Op } from '@sequelize/core';
import { randomInt } from 'node:crypto';
import { SEQUELIZE } from '../database/database.module';
import { CONFIG, type AppConfig } from '../config/env';
import {
  Assignment,
  ChatMessage,
  Edition,
  Participant,
  Thread,
  User,
} from '../database/models';
import { CryptoService } from '../crypto/crypto.service';
import { MailService } from '../mail/mail.service';
import { I18nService } from '../i18n/i18n.service';
import { AccessService } from '../groups/access.service';
import { AliasService } from '../aliases/alias.service';
import { DrawService, type HistoryEdition, MIN_PARTICIPANTS } from './draw.service';
import type { SessionUser } from '../auth/auth.service';

export interface DrawCard {
  state: 'not_drawn' | 'ready' | 'checked' | 'no_card';
  changed: boolean;
  signedInAs?: string;
  budgetAmount?: string | null;
  budgetCurrency?: string | null;
  exchangeDate?: string | null;
}

@Injectable()
export class DrawExecutionService {
  private readonly logger = new Logger('Draw');

  constructor(
    @Inject(SEQUELIZE) private readonly sequelize: Sequelize,
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly crypto: CryptoService,
    private readonly draw: DrawService,
    private readonly access: AccessService,
    private readonly mail: MailService,
    private readonly i18n: I18nService,
    private readonly aliases: AliasService,
  ) {}

  /** Run the draw for an edition. Admin only. */
  async runDraw(editionId: string, user: SessionUser): Promise<{
    participants: number;
    lookbackAchieved: number;
    relaxed: boolean;
  }> {
    const ctx = await this.access.getEditionContext(editionId, user.id);
    await this.access.requireAdmin(ctx.group.id, user.id);
    if (ctx.edition.state !== 'open') throw new ConflictException('already_drawn');

    const participants = await Participant.findAll({ where: { editionId } });
    if (participants.some((p) => p.status !== 'confirmed')) {
      throw new ConflictException('not_all_confirmed');
    }
    if (participants.length < MIN_PARTICIPANTS) {
      throw new ConflictException('need_at_least_3');
    }

    // Draw is computed over user ids (stable across editions for no-repeat),
    // then mapped back to this edition's participant ids.
    const userIdToParticipant = new Map<string, Participant>();
    for (const p of participants) {
      if (!p.userId) throw new ConflictException('participant_without_account');
      userIdToParticipant.set(p.userId, p);
    }
    const userIds = [...userIdToParticipant.keys()];

    const history = await this.buildHistory(ctx.group.id, editionId);
    const result = this.draw.draw(userIds, history);

    const aliasKeys = this.aliases.assign(ctx.edition.theme, participants.length);

    await this.sequelize.transaction(async (tx) => {
      // Encrypt recipient participant ids and insert rows in SHUFFLED order
      // (insertion order must not spell out the loop).
      const rows = result.assignments.map((a) => {
        const giver = userIdToParticipant.get(a.giverId)!;
        const recipient = userIdToParticipant.get(a.recipientId)!;
        const sealed = this.crypto.encrypt(recipient.id);
        return {
          editionId,
          giverParticipantId: giver.id,
          recipientCiphertext: sealed.ciphertext,
          nonce: sealed.nonce,
        };
      });
      shuffle(rows);
      await Assignment.bulkCreate(rows, { transaction: tx });

      // Assign aliases and open a private thread per recipient.
      for (let i = 0; i < participants.length; i++) {
        participants[i].aliasKey = aliasKeys[i];
        await participants[i].save({ transaction: tx });
      }
      for (const a of result.assignments) {
        const recipient = userIdToParticipant.get(a.recipientId)!;
        await Thread.create(
          { editionId, recipientParticipantId: recipient.id },
          { transaction: tx },
        );
      }

      ctx.edition.state = 'drawn';
      ctx.edition.drawnAt = new Date();
      ctx.edition.noRepeatLookback = result.lookbackAchieved;
      await ctx.edition.save({ transaction: tx });
    });

    // E4 — "your draw is ready" to every participant.
    await this.emailParticipants(participants, ctx.edition, (to, lang) =>
      this.mail.sendDrawReady(to, `${this.config.appUrl}/editions/${editionId}`, lang, ctx.edition.theme),
    );

    const maxLookback = Math.min(3, history.length);
    return {
      participants: participants.length,
      lookbackAchieved: result.lookbackAchieved,
      relaxed: result.lookbackAchieved < maxLookback,
    };
  }

  /** The draw card — never contains the recipient's name. */
  async getDrawCard(editionId: string, user: SessionUser): Promise<DrawCard> {
    const ctx = await this.access.getEditionContext(editionId, user.id);
    if (ctx.edition.state === 'open') {
      return { state: 'not_drawn', changed: false };
    }
    if (!ctx.participant) return { state: 'no_card', changed: false };
    return {
      state: ctx.participant.drawCheckedAt ? 'checked' : 'ready',
      changed: ctx.participant.drawChanged,
      signedInAs: user.firstName ?? undefined,
      budgetAmount: ctx.edition.budgetAmount,
      budgetCurrency: ctx.edition.budgetCurrency,
      exchangeDate: ctx.edition.exchangeDate,
    };
  }

  /**
   * THE reveal endpoint — the only response in the whole app that contains a
   * recipient, and only the caller's own. Fetched on hold-completion.
   */
  async reveal(editionId: string, user: SessionUser): Promise<{ recipientFirstName: string }> {
    const ctx = await this.access.getEditionContext(editionId, user.id);
    if (ctx.edition.state === 'open') throw new ConflictException('not_drawn');
    if (!ctx.participant) throw new NotFoundException();

    const assignment = await Assignment.findOne({
      where: { editionId, giverParticipantId: ctx.participant.id },
    });
    if (!assignment) throw new NotFoundException();

    const recipientParticipantId = this.crypto.decrypt(assignment.recipientCiphertext, assignment.nonce);
    const recipient = await Participant.findByPk(recipientParticipantId);
    const recipientUser = recipient?.userId ? await User.findByPk(recipient.userId) : null;
    const firstName = recipientUser?.firstName ?? recipient?.invitedFirstName ?? '…';

    // First reveal sets "draw checked" (one-way). Then maybe open the chat.
    // Any "changed" notice is cleared now that the giver has seen the new draw.
    const firstCheck = !ctx.participant.drawCheckedAt;
    if (firstCheck || ctx.participant.drawChanged) {
      if (firstCheck) ctx.participant.drawCheckedAt = new Date();
      ctx.participant.drawChanged = false;
      await ctx.participant.save();
      if (firstCheck) await this.maybeOpenChat(editionId);
    }

    return { recipientFirstName: firstName };
  }

  /** Admin opens the chat early (before everyone has checked). */
  async openChatNow(editionId: string, user: SessionUser): Promise<{ ok: true }> {
    const ctx = await this.access.getEditionContext(editionId, user.id);
    await this.access.requireAdmin(ctx.group.id, user.id);
    if (ctx.edition.state === 'open') throw new ConflictException('not_drawn');
    if (!ctx.edition.chatOpenedAt) {
      ctx.edition.chatOpenedAt = new Date();
      await ctx.edition.save();
      await this.announceChatOpen(editionId, ctx.edition);
    }
    return { ok: true };
  }

  /** When every participant has checked their draw, open the chat and email E6. */
  private async maybeOpenChat(editionId: string): Promise<void> {
    const edition = await Edition.findByPk(editionId);
    if (!edition || edition.chatOpenedAt) return;
    const participants = await Participant.findAll({ where: { editionId } });
    if (participants.length && participants.every((p) => p.drawCheckedAt)) {
      edition.chatOpenedAt = new Date();
      await edition.save();
      await this.announceChatOpen(editionId, edition);
    }
  }

  private async announceChatOpen(editionId: string, edition: Edition): Promise<void> {
    // System message marking the chat as open.
    await ChatMessage.create({ editionId, systemKind: 'chat_opened' });
    const participants = await Participant.findAll({ where: { editionId } });
    await this.emailParticipants(participants, edition, (to, lang) =>
      this.mail.sendChatOpen(to, `${this.config.appUrl}/editions/${editionId}`, lang, edition.theme),
    );
  }

  /** Decrypt the group's last 3 drawn/archived editions into no-repeat history. */
  private async buildHistory(groupId: string, exceptEditionId: string): Promise<HistoryEdition[]> {
    const past = await Edition.findAll({
      where: {
        groupId,
        id: { [Op.ne]: exceptEditionId },
        state: { [Op.in]: ['drawn', 'archived'] },
      },
      order: [['drawnAt', 'DESC']],
      limit: 3,
    });

    const history: HistoryEdition[] = [];
    for (const edition of past) {
      const assignments = await Assignment.findAll({ where: { editionId: edition.id } });
      const pairs = new Map<string, string>();
      for (const a of assignments) {
        const giver = await Participant.findByPk(a.giverParticipantId);
        const recipientId = this.crypto.decrypt(a.recipientCiphertext, a.nonce);
        const recipient = await Participant.findByPk(recipientId);
        if (giver?.userId && recipient?.userId) {
          pairs.set(giver.userId, recipient.userId);
        }
      }
      history.push({ pairs });
    }
    return history;
  }

  private async emailParticipants(
    participants: Participant[],
    _edition: Edition,
    sendOne: (to: string, lang: ReturnType<I18nService['normalize']>) => Promise<void>,
  ): Promise<void> {
    for (const p of participants) {
      const u = p.userId ? await User.findByPk(p.userId) : null;
      const to = u?.email ?? p.invitedEmail;
      if (!to) continue;
      const lang = this.i18n.normalize(u?.language ?? this.config.defaultLanguage);
      try {
        await sendOne(to, lang);
      } catch (err) {
        this.logger.error(`email failed: ${(err as Error).message}`);
      }
    }
  }
}

/** In-place Fisher–Yates with a CSPRNG. */
function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
