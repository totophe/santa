import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Assignment,
  ChatMessage,
  Participant,
  Thread,
  ThreadMessage,
} from '../database/models';
import type { SessionUser } from '../auth/auth.service';
import { AccessService } from '../groups/access.service';
import { AliasService } from '../aliases/alias.service';
import { CryptoService } from '../crypto/crypto.service';
import { I18nService } from '../i18n/i18n.service';
import { RateLimitService, MINUTE } from '../safety/rate-limit.service';
import { CONFIG, type AppConfig } from '../config/env';
import { Inject } from '@nestjs/common';

const MAX_BODY = 1000;

/** Preset one-tap questions a giver can send (keys; the client localises). */
export const PRESET_QUESTIONS = [
  'sweet_or_savoury',
  'surprise_or_practical',
  'what_size',
  'colour_to_avoid',
] as const;

@Injectable()
export class MessagesService {
  constructor(
    private readonly access: AccessService,
    private readonly aliases: AliasService,
    private readonly crypto: CryptoService,
    private readonly i18n: I18nService,
    private readonly rateLimit: RateLimitService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  private async limitMessages(participantId: string): Promise<void> {
    await this.rateLimit.hit(
      'messages',
      participantId,
      this.config.rateLimits.messagesPerParticipant,
      MINUTE,
    );
  }

  // ─── Private threads ──────────────────────────────────────────────────

  async getThreadAsRecipient(editionId: string, user: SessionUser) {
    const { edition, participant } = await this.requireParticipant(editionId, user);
    if (edition.state === 'open') throw new ConflictException('not_drawn');
    const thread = await Thread.findOne({
      where: { editionId, recipientParticipantId: participant.id },
    });
    if (!thread) throw new NotFoundException();
    return {
      title: this.i18n.t('thread.recipient_title', { lang: user.language, theme: edition.theme }),
      readOnly: edition.state === 'archived',
      messages: await this.threadMessages(thread.id, 'recipient'),
    };
  }

  async getThreadAsGiver(editionId: string, user: SessionUser) {
    const { edition, participant } = await this.requireParticipant(editionId, user);
    if (edition.state === 'open') throw new ConflictException('not_drawn');
    const thread = await this.giverThread(editionId, participant.id);
    return {
      // Never the recipient's name.
      title: this.i18n.t('thread.giver_title', { lang: user.language, theme: edition.theme }),
      readOnly: edition.state === 'archived',
      presetQuestions: PRESET_QUESTIONS,
      messages: await this.threadMessages(thread.id, 'santa'),
    };
  }

  async postAsRecipient(editionId: string, user: SessionUser, body: string) {
    const { edition, participant } = await this.requireParticipant(editionId, user);
    this.ensureWritable(edition.state);
    await this.limitMessages(participant.id);
    const thread = await Thread.findOne({
      where: { editionId, recipientParticipantId: participant.id },
    });
    if (!thread) throw new NotFoundException();
    await ThreadMessage.create({ threadId: thread.id, fromRole: 'recipient', body: clean(body) });
    return this.getThreadAsRecipient(editionId, user);
  }

  async postAsGiver(editionId: string, user: SessionUser, body: string) {
    const { edition, participant } = await this.requireParticipant(editionId, user);
    this.ensureWritable(edition.state);
    await this.limitMessages(participant.id);
    const thread = await this.giverThread(editionId, participant.id);
    await ThreadMessage.create({ threadId: thread.id, fromRole: 'santa', body: clean(body) });
    return this.getThreadAsGiver(editionId, user);
  }

  /** The thread for the person THIS user drew (found by decrypting their row). */
  private async giverThread(editionId: string, giverParticipantId: string): Promise<Thread> {
    const assignment = await Assignment.findOne({
      where: { editionId, giverParticipantId },
    });
    if (!assignment) throw new NotFoundException();
    const recipientParticipantId = this.crypto.decrypt(assignment.recipientCiphertext, assignment.nonce);
    const thread = await Thread.findOne({
      where: { editionId, recipientParticipantId },
    });
    if (!thread) throw new NotFoundException();
    return thread;
  }

  private async threadMessages(threadId: string, viewerRole: 'santa' | 'recipient') {
    const msgs = await ThreadMessage.findAll({
      where: { threadId },
      order: [['createdAt', 'ASC']],
    });
    // Payload carries a role only; "mine" is derived from the viewer's role.
    return msgs.map((m) => ({
      id: m.id,
      role: m.fromRole,
      mine: m.fromRole === viewerRole,
      body: m.body,
      createdAt: m.createdAt,
    }));
  }

  // ─── Group chat ───────────────────────────────────────────────────────

  async getChat(editionId: string, user: SessionUser) {
    const ctx = await this.access.getEditionContext(editionId, user.id);
    const myAlias =
      ctx.participant?.aliasKey
        ? this.aliases.display(ctx.edition.theme, ctx.participant.aliasKey, user.language)
        : null;

    if (!ctx.edition.chatOpenedAt) {
      // Locked: show who still has to check their draw, so people can chase them.
      const participants = await Participant.findAll({ where: { editionId } });
      const toCheck = participants.filter((p) => !p.drawCheckedAt).length;
      return { locked: true as const, toCheck, total: participants.length, myAlias };
    }

    const messages = await ChatMessage.findAll({
      where: { editionId },
      order: [['createdAt', 'ASC']],
    });
    return {
      locked: false as const,
      myAlias,
      canPost: !!ctx.participant && ctx.edition.state !== 'archived',
      isAdmin: ctx.isAdmin,
      messages: messages.map((m) => this.chatDto(m, ctx.edition.theme, user.language, myAlias?.key ?? null)),
    };
  }

  async postChat(editionId: string, user: SessionUser, body: string) {
    const ctx = await this.access.getEditionContext(editionId, user.id);
    if (!ctx.edition.chatOpenedAt) throw new ConflictException('chat_locked');
    if (ctx.edition.state === 'archived') throw new ConflictException('archived');
    if (!ctx.participant?.aliasKey) throw new ForbiddenException('not_a_participant');
    await this.limitMessages(ctx.participant.id);
    await ChatMessage.create({ editionId, aliasKey: ctx.participant.aliasKey, body: clean(body) });
    return this.getChat(editionId, user);
  }

  async deleteChatMessage(messageId: string, user: SessionUser) {
    const message = await ChatMessage.findByPk(messageId);
    if (!message) throw new NotFoundException();
    const ctx = await this.access.getEditionContext(message.editionId, user.id);
    await this.access.requireAdmin(ctx.group.id, user.id);
    message.deletedAt = new Date();
    await message.save();
    return { ok: true as const };
  }

  private chatDto(
    m: ChatMessage,
    theme: string,
    lang: string,
    myAliasKey: string | null,
  ) {
    if (m.systemKind) {
      return { id: m.id, system: m.systemKind, createdAt: m.createdAt };
    }
    const removed = !!m.deletedAt;
    return {
      id: m.id,
      alias: m.aliasKey ? this.aliases.display(theme, m.aliasKey, lang) : null,
      mine: !!m.aliasKey && m.aliasKey === myAliasKey,
      body: removed ? null : m.body,
      removed,
      createdAt: m.createdAt,
    };
  }

  // ─── helpers ──────────────────────────────────────────────────────────

  private async requireParticipant(
    editionId: string,
    user: SessionUser,
  ): Promise<{ edition: import('../database/models').Edition; participant: Participant }> {
    const ctx = await this.access.getEditionContext(editionId, user.id);
    if (!ctx.participant) throw new NotFoundException();
    return { edition: ctx.edition, participant: ctx.participant };
  }

  private ensureWritable(state: string): void {
    if (state === 'archived') throw new ConflictException('archived');
    if (state === 'open') throw new ConflictException('not_drawn');
  }
}

function clean(body: string): string {
  const trimmed = (body ?? '').trim();
  if (!trimmed) throw new BadRequestException('empty');
  if (trimmed.length > MAX_BODY) throw new BadRequestException('too_long');
  return trimmed;
}
