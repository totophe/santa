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
  Group,
  Membership,
  Participant,
  User,
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
      wishlistState: 'not_yet',
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

  /** Pre-auth: the join page shows only the group and edition names. */
  async joinInfo(token: string) {
    const edition = await Edition.findOne({ where: { inviteToken: token } });
    if (!edition) return { state: 'revoked' as const };
    if (edition.state !== 'open') return { state: 'closed' as const };
    const group = await Group.findByPk(edition.groupId);
    if (!group) return { state: 'revoked' as const };
    return {
      state: 'open' as const,
      groupName: group.name,
      editionName: edition.name,
      theme: edition.theme,
    };
  }

  async join(token: string, user: SessionUser): Promise<{ editionId: string }> {
    const edition = await Edition.findOne({ where: { inviteToken: token } });
    if (!edition) throw new NotFoundException('revoked');
    if (edition.state !== 'open') throw new ConflictException('entries_closed');

    return this.sequelize.transaction(async (tx) => {
      const existing = await Membership.findOne({
        where: { groupId: edition.groupId, userId: user.id },
        transaction: tx,
      });
      if (!existing) {
        const count = await Membership.count({
          where: { groupId: edition.groupId },
          transaction: tx,
        });
        if (count >= this.config.rateLimits.membersPerGroup) {
          throw new BadRequestException('group_full');
        }
        await Membership.create(
          { groupId: edition.groupId, userId: user.id, role: 'member' },
          { transaction: tx },
        );
      }

      let participant = await Participant.findOne({
        where: { editionId: edition.id, userId: user.id },
        transaction: tx,
      });
      if (!participant) {
        participant = await Participant.create(
          {
            editionId: edition.id,
            userId: user.id,
            status: 'confirmed',
            confirmedAt: new Date(),
          },
          { transaction: tx },
        );
      } else if (participant.status !== 'confirmed') {
        participant.status = 'confirmed';
        participant.confirmedAt = new Date();
        await participant.save({ transaction: tx });
      }

      await Group.update(
        { lastActivityAt: new Date() },
        { where: { id: edition.groupId }, transaction: tx },
      );
      return { editionId: edition.id };
    });
  }

  private async touch(groupId: string): Promise<void> {
    await Group.update({ lastActivityAt: new Date() }, { where: { id: groupId } });
  }
}
