import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Sequelize, Op, type Transaction } from '@sequelize/core';
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
import type { CreateGroupDto, EditionInputDto } from './dto';
import { AccessService } from './access.service';
import { RateLimitService, DAY } from '../safety/rate-limit.service';

export interface EditionSummary {
  id: string;
  name: string;
  theme: string;
  state: string;
  exchangeDate: string | null;
  budgetAmount: string | null;
  budgetCurrency: string | null;
  daysToGo: number | null;
  myStatus: 'invited' | 'confirmed' | null;
  counts: { participants: number; confirmed: number };
}

export interface GroupSummary {
  id: string;
  name: string;
  defaultLanguage: string;
  role: string;
  currentEdition: EditionSummary | null;
}

@Injectable()
export class GroupsService {
  constructor(
    @Inject(SEQUELIZE) private readonly sequelize: Sequelize,
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly access: AccessService,
    private readonly rateLimit: RateLimitService,
  ) {}

  canCreateGroup(email: string): boolean {
    const e = email.toLowerCase();
    switch (this.config.groupCreation) {
      case 'open':
        return true;
      case 'allowlist':
        return this.config.groupCreationAllowlist.includes(e);
      case 'admins':
        return this.config.instanceAdmins.includes(e);
      default:
        return false;
    }
  }

  async createGroupWithEdition(
    user: SessionUser,
    dto: CreateGroupDto,
  ): Promise<{ group: Group; edition: Edition; inviteUrl: string }> {
    if (!this.canCreateGroup(user.email)) {
      throw new ForbiddenException('group_creation_not_allowed');
    }
    await this.rateLimit.hit('group_create', user.id, this.config.rateLimits.groupsPerAccount, DAY);

    const result = await this.sequelize.transaction(async (tx) => {
      const group = await Group.create(
        {
          name: dto.name.trim(),
          defaultLanguage: dto.defaultLanguage ?? this.config.defaultLanguage,
          createdBy: user.id,
          lastActivityAt: new Date(),
        },
        { transaction: tx },
      );

      await Membership.create(
        { groupId: group.id, userId: user.id, role: 'admin' },
        { transaction: tx },
      );

      const edition = await this.buildEdition(tx, group.id, user, dto.edition);
      return { group, edition };
    });

    return {
      ...result,
      inviteUrl: this.inviteUrl(result.edition.inviteToken),
    };
  }

  /**
   * Create an edition (open, with a fresh invite token) and enrol the creator as
   * a confirmed participant. Shared by group creation and starting a new edition.
   */
  private async buildEdition(
    tx: Transaction,
    groupId: string,
    user: SessionUser,
    input: EditionInputDto,
  ): Promise<Edition> {
    const edition = await Edition.create(
      {
        groupId,
        name: input.name.trim(),
        theme: input.theme ?? 'generic',
        exchangeDate: input.exchangeDate ?? null,
        timezone: input.timezone ?? null,
        budgetAmount: input.budgetAmount ?? null,
        budgetCurrency: input.budgetCurrency ?? null,
        state: 'open',
        inviteToken: randomUrlToken(16),
      },
      { transaction: tx },
    );
    // The creator is a confirmed participant from the start.
    await Participant.create(
      {
        editionId: edition.id,
        userId: user.id,
        status: 'confirmed',
        confirmedAt: new Date(),
      },
      { transaction: tx },
    );
    return edition;
  }

  /**
   * Start a new edition in an existing group (admins only). Enforces the
   * "one live edition at a time" rule so the recurring group reuses cleanly;
   * the new edition chains into the draw no-repeat lookback automatically.
   */
  async createEdition(
    groupId: string,
    user: SessionUser,
    input: EditionInputDto,
  ): Promise<{ edition: Edition; inviteUrl: string }> {
    await this.access.requireAdmin(groupId, user.id);
    if (await this.currentEdition(groupId)) {
      throw new ConflictException('edition_in_progress');
    }
    const edition = await this.sequelize.transaction((tx) =>
      this.buildEdition(tx, groupId, user, input),
    );
    const group = await Group.findByPk(groupId);
    if (group) {
      group.lastActivityAt = new Date();
      await group.save();
    }
    return { edition, inviteUrl: this.inviteUrl(edition.inviteToken) };
  }

  /**
   * Leave a group. Blocked when it would strand the group or break a live draw:
   * the sole member should delete instead; a sole admin must promote a successor
   * first; and someone still inside a drawn (non-archived) edition can't slip out
   * without breaking the loop (that path is admin removal, which repairs it).
   */
  async leaveGroup(groupId: string, user: SessionUser): Promise<{ ok: true }> {
    const membership = await this.access.requireMember(groupId, user.id);

    const memberCount = await Membership.count({ where: { groupId } });
    if (memberCount <= 1) throw new ConflictException('delete_instead');
    if (membership.role === 'admin') {
      const adminCount = await Membership.count({ where: { groupId, role: 'admin' } });
      if (adminCount <= 1) throw new ConflictException('promote_another_admin_first');
    }

    const drawn = await Edition.findAll({ where: { groupId, state: 'drawn' } });
    for (const e of drawn) {
      const p = await Participant.findOne({ where: { editionId: e.id, userId: user.id } });
      if (p) throw new ConflictException('active_draw');
    }

    const open = await Edition.findAll({ where: { groupId, state: 'open' } });
    await this.sequelize.transaction(async (tx) => {
      for (const e of open) {
        await Participant.destroy({ where: { editionId: e.id, userId: user.id }, transaction: tx });
      }
      await membership.destroy({ transaction: tx });
    });
    return { ok: true as const };
  }

  inviteUrl(token: string | null): string {
    return token ? `${this.config.appUrl}/join/${token}` : '';
  }

  async listMyGroups(userId: string): Promise<GroupSummary[]> {
    const memberships = await Membership.findAll({ where: { userId } });
    const summaries: GroupSummary[] = [];
    for (const m of memberships) {
      const group = await Group.findByPk(m.groupId);
      if (!group) continue;
      const edition = await this.currentEdition(group.id);
      summaries.push({
        id: group.id,
        name: group.name,
        defaultLanguage: group.defaultLanguage,
        role: m.role,
        currentEdition: edition ? await this.editionSummary(edition, userId) : null,
      });
    }
    return summaries;
  }

  async getGroupDetail(groupId: string, userId: string) {
    const membership = await Membership.findOne({ where: { groupId, userId } });
    if (!membership) throw new NotFoundException();
    const group = await Group.findByPk(groupId);
    if (!group) throw new NotFoundException();

    const members = await Membership.findAll({ where: { groupId } });
    const memberDtos = await Promise.all(
      members.map(async (mem) => {
        const u = await User.findByPk(mem.userId);
        return {
          userId: mem.userId,
          firstName: u?.firstName ?? null,
          lastName: u?.lastName ?? null,
          role: mem.role,
          isYou: mem.userId === userId,
        };
      }),
    );

    const editions = await Edition.findAll({
      where: { groupId },
      order: [['createdAt', 'DESC']],
    });

    return {
      id: group.id,
      name: group.name,
      defaultLanguage: group.defaultLanguage,
      role: membership.role,
      members: memberDtos,
      editions: editions.map((e) => ({
        id: e.id,
        name: e.name,
        theme: e.theme,
        state: e.state,
        exchangeDate: e.exchangeDate,
      })),
    };
  }

  /** The single non-archived edition, if any. */
  async currentEdition(groupId: string): Promise<Edition | null> {
    return Edition.findOne({
      where: { groupId, state: { [Op.ne]: 'archived' } },
    });
  }

  async editionSummary(edition: Edition, userId: string): Promise<EditionSummary> {
    const participants = await Participant.findAll({
      where: { editionId: edition.id },
    });
    const confirmed = participants.filter((p) => p.status === 'confirmed').length;
    const mine = participants.find((p) => p.userId === userId) ?? null;
    return {
      id: edition.id,
      name: edition.name,
      theme: edition.theme,
      state: edition.state,
      exchangeDate: edition.exchangeDate,
      budgetAmount: edition.budgetAmount,
      budgetCurrency: edition.budgetCurrency,
      daysToGo: daysUntil(edition.exchangeDate),
      myStatus: mine ? mine.status : null,
      counts: { participants: participants.length, confirmed },
    };
  }
}

/** Whole days from today (UTC) to an ISO date; null if no date. */
export function daysUntil(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const today = new Date();
  const target = new Date(`${isoDate}T00:00:00Z`);
  const t0 = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const ms = target.getTime() - t0;
  return Math.round(ms / 86_400_000);
}
