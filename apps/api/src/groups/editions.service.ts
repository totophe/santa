import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Sequelize } from '@sequelize/core';
import { SEQUELIZE } from '../database/database.module';
import { CONFIG, type AppConfig } from '../config/env';
import {
  Edition,
  EditionExclusion,
  Group,
  Membership,
  Participant,
  User,
  Wishlist,
} from '../database/models';
import { randomUrlToken } from '../auth/tokens';
import type { SessionUser } from '../auth/auth.service';
import { AccessService } from './access.service';
import { GroupsService, daysUntil } from './groups.service';

export interface ParticipantRow {
  id: string;
  firstName: string;
  lastInitial: string | null;
  isAdmin: boolean;
  isYou: boolean;
  status: 'invited' | 'confirmed' | 'draw_checked';
  wishlistState: 'published' | 'surprise' | 'not_yet';
}

@Injectable()
export class EditionsService {
  constructor(
    @Inject(SEQUELIZE) private readonly sequelize: Sequelize,
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly access: AccessService,
    private readonly groups: GroupsService,
  ) {}

  async getEditionDetail(editionId: string, user: SessionUser) {
    const ctx = await this.access.getEditionContext(editionId, user.id);
    // A member who is not a participant can still manage (admin) but has no card.
    if (!ctx.participant && !ctx.isAdmin) throw new NotFoundException();

    const summary = await this.groups.editionSummary(ctx.edition, user.id);
    return {
      ...summary,
      groupId: ctx.group.id,
      groupName: ctx.group.name,
      isAdmin: ctx.isAdmin,
      chatOpen: !!ctx.edition.chatOpenedAt,
      inviteUrl: ctx.isAdmin ? this.groups.inviteUrl(ctx.edition.inviteToken) : undefined,
      daysToGo: daysUntil(ctx.edition.exchangeDate),
    };
  }

  async listParticipants(editionId: string, user: SessionUser): Promise<{
    participants: ParticipantRow[];
    summary: { confirmed: number; checked: number; total: number; drawn: boolean };
  }> {
    const ctx = await this.access.getEditionContext(editionId, user.id);
    const participants = await Participant.findAll({ where: { editionId } });

    // Map group members to roles, and collect first-name collisions.
    const members = await Membership.findAll({ where: { groupId: ctx.group.id } });
    const roleByUser = new Map(members.map((m) => [m.userId, m.role]));

    // Wishlist state per participant (null/draft → not_yet).
    const wishlists = await Wishlist.findAll({ where: { participantId: participants.map((p) => p.id) } });
    const wlByParticipant = new Map(wishlists.map((w) => [w.participantId, w.state]));
    const wishlistStateOf = (participantId: string): 'published' | 'surprise' | 'not_yet' => {
      const s = wlByParticipant.get(participantId);
      return s === 'published' ? 'published' : s === 'surprise' ? 'surprise' : 'not_yet';
    };

    const rows = await Promise.all(
      participants.map(async (p) => {
        const u = p.userId ? await User.findByPk(p.userId) : null;
        const firstName = (u?.firstName ?? p.invitedFirstName ?? '…').trim();
        const lastName = u?.lastName ?? null;
        return {
          p,
          firstName,
          lastName,
          isAdmin: p.userId ? roleByUser.get(p.userId) === 'admin' : false,
          isYou: p.userId === user.id,
        };
      }),
    );

    // Last initial only when two participants share a first name.
    const nameCounts = new Map<string, number>();
    for (const r of rows) nameCounts.set(r.firstName, (nameCounts.get(r.firstName) ?? 0) + 1);

    const dtos: ParticipantRow[] = rows.map((r) => ({
      id: r.p.id,
      firstName: r.firstName,
      lastInitial:
        (nameCounts.get(r.firstName) ?? 0) > 1 && r.lastName
          ? r.lastName.charAt(0).toUpperCase()
          : null,
      isAdmin: r.isAdmin,
      isYou: r.isYou,
      status: r.p.drawCheckedAt
        ? 'draw_checked'
        : (r.p.status as 'invited' | 'confirmed'),
      wishlistState: wishlistStateOf(r.p.id),
    }));

    // Waiting first: invited, then confirmed, then draw checked.
    const order = { invited: 0, confirmed: 1, draw_checked: 2 } as const;
    dtos.sort((a, b) => order[a.status] - order[b.status] || a.firstName.localeCompare(b.firstName));

    return {
      participants: dtos,
      summary: {
        confirmed: participants.filter((p) => p.status === 'confirmed').length,
        checked: participants.filter((p) => p.drawCheckedAt).length,
        total: participants.length,
        drawn: ctx.edition.state !== 'open',
      },
    };
  }

  async confirm(editionId: string, user: SessionUser): Promise<void> {
    const ctx = await this.access.getEditionContext(editionId, user.id);
    if (ctx.edition.state !== 'open') throw new ConflictException('entries_closed');
    const p = ctx.participant
      ?? (await Participant.create({ editionId, userId: user.id, status: 'invited' }));
    if (p.status !== 'confirmed') {
      p.status = 'confirmed';
      p.confirmedAt = new Date();
      await p.save();
    }
    await this.touch(ctx.group.id);
  }

  async decline(editionId: string, user: SessionUser): Promise<void> {
    const ctx = await this.access.getEditionContext(editionId, user.id);
    if (ctx.edition.state !== 'open') throw new ConflictException('entries_closed');
    if (ctx.participant) await ctx.participant.destroy();
  }

  async regenerateInvite(editionId: string, user: SessionUser): Promise<{ inviteUrl: string }> {
    const ctx = await this.access.getEditionContext(editionId, user.id);
    await this.access.requireAdmin(ctx.group.id, user.id);
    if (ctx.edition.state !== 'open') throw new ConflictException('entries_closed');
    ctx.edition.inviteToken = randomUrlToken(16);
    await ctx.edition.save();
    return { inviteUrl: this.groups.inviteUrl(ctx.edition.inviteToken) };
  }

  /** The edition's exclusion pairs (couples who won't draw each other). Admin only. */
  async getExclusions(editionId: string, user: SessionUser): Promise<{
    exclusions: Array<{ aParticipantId: string; bParticipantId: string; aName: string; bName: string }>;
  }> {
    const ctx = await this.access.getEditionContext(editionId, user.id);
    await this.access.requireAdmin(ctx.group.id, user.id);
    const rows = await EditionExclusion.findAll({ where: { editionId } });
    const name = async (participantId: string): Promise<string> => {
      const p = await Participant.findByPk(participantId);
      if (!p) return '…';
      const u = p.userId ? await User.findByPk(p.userId) : null;
      return (u?.firstName ?? p.invitedFirstName ?? '…').trim();
    };
    const exclusions = await Promise.all(
      rows.map(async (r) => ({
        aParticipantId: r.participantAId,
        bParticipantId: r.participantBId,
        aName: await name(r.participantAId),
        bName: await name(r.participantBId),
      })),
    );
    return { exclusions };
  }

  private async touch(groupId: string): Promise<void> {
    await Group.update({ lastActivityAt: new Date() }, { where: { id: groupId } });
  }
}
