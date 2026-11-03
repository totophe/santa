import {
  BadRequestException,
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
  EditionExclusion,
  Group,
  Membership,
  Participant,
  User,
} from '../database/models';
import type { GroupVisibility } from '../database/models/group.model';
import { isFeasible, forbiddenSet } from '../draw/draw.service';
import { randomUrlToken } from '../auth/tokens';
import { AuthService, type SessionUser } from '../auth/auth.service';
import type { CreateGroupDto, EditionInputDto, ExclusionPairDto, GroupSettingsDto, InviteEntryDto } from './dto';
import { AccessService } from './access.service';
import { RateLimitService, DAY } from '../safety/rate-limit.service';
import { SuppressionService } from '../safety/suppression.service';
import { MailService } from '../mail/mail.service';
import { I18nService } from '../i18n/i18n.service';

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
  // Set only by listMyActiveEditions (the Home feed needs the owning group).
  groupId?: string;
  groupName?: string;
}

export interface GroupSummary {
  id: string;
  name: string;
  defaultLanguage: string;
  role: string;
  // 'invited' = you were added by email and haven't accepted yet.
  myStatus: 'active' | 'invited';
  memberCount: number;
  pendingCount: number;
  currentEdition: EditionSummary | null;
}

@Injectable()
export class GroupsService {
  constructor(
    @Inject(SEQUELIZE) private readonly sequelize: Sequelize,
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly access: AccessService,
    private readonly rateLimit: RateLimitService,
    private readonly suppression: SuppressionService,
    private readonly mail: MailService,
    private readonly auth: AuthService,
    private readonly i18n: I18nService,
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
          inviteToken: randomUrlToken(16),
        },
        { transaction: tx },
      );

      await Membership.create(
        { groupId: group.id, userId: user.id, role: 'admin', status: 'active' },
        { transaction: tx },
      );

      const edition = await this.buildEdition(tx, group.id, user, dto.edition);
      return { group, edition };
    });

    // Seed the group with any typed email invites (after commit — sends emails).
    if (dto.invites?.length) {
      await this.inviteByEmail(result.group.id, user, dto.invites);
    }

    return {
      ...result,
      inviteUrl: this.inviteUrl(result.group.inviteToken),
    };
  }

  /**
   * Create an edition (open) and enrol the chosen active members as participants:
   * the creator is confirmed, everyone else is invited (they still RSVP). When
   * `participantUserIds` is given, only those members are enrolled (the admin
   * deselected the rest); otherwise everyone joins. Exclusion pairs (couples who
   * must not draw each other) are stored against the created participants.
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

    const members = await Membership.findAll({
      where: { groupId, status: 'active' },
      transaction: tx,
    });
    const selected = input.participantUserIds
      ? new Set(input.participantUserIds)
      : null; // null = everyone

    const participantByUser = new Map<string, string>();
    for (const m of members) {
      if (!m.userId) continue; // active members always have an account
      const isCreator = m.userId === user.id;
      // Honour the selection, but the creator is always in if they didn't deselect.
      if (selected && !selected.has(m.userId)) continue;
      const p = await Participant.create(
        {
          editionId: edition.id,
          userId: m.userId,
          status: isCreator ? 'confirmed' : 'invited',
          confirmedAt: isCreator ? new Date() : null,
        },
        { transaction: tx },
      );
      participantByUser.set(m.userId, p.id);
    }

    await this.storeExclusions(tx, edition.id, input.exclusions ?? [], participantByUser);
    return edition;
  }

  /** Persist exclusion pairs (by member user id) as canonical participant pairs. */
  private async storeExclusions(
    tx: Transaction,
    editionId: string,
    pairs: ExclusionPairDto[],
    participantByUser: Map<string, string>,
  ): Promise<void> {
    const seen = new Set<string>();
    for (const { a, b } of pairs) {
      const pa = participantByUser.get(a);
      const pb = participantByUser.get(b);
      if (!pa || !pb || pa === pb) continue; // both must be participants
      const [lo, hi] = pa < pb ? [pa, pb] : [pb, pa]; // canonical a < b
      const key = `${lo}|${hi}`;
      if (seen.has(key)) continue;
      seen.add(key);
      await EditionExclusion.create(
        { editionId, participantAId: lo, participantBId: hi },
        { transaction: tx },
      );
    }
  }

  /**
   * Would a draw be possible for this set of members under these exclusions?
   * Powers the creation wizard's live check (the draw itself re-checks the
   * confirmed set at run time). Admins only.
   */
  async checkFeasibility(
    groupId: string,
    user: SessionUser,
    participantUserIds: string[],
    exclusions: ExclusionPairDto[],
  ): Promise<{ feasible: boolean; reason?: 'too_few' | 'restrictions' }> {
    await this.access.requireAdmin(groupId, user.id);
    const members = await Membership.findAll({ where: { groupId, status: 'active' } });
    const memberIds = new Set(members.map((m) => m.userId));
    const ids = participantUserIds.filter((id) => memberIds.has(id));
    if (ids.length < 3) return { feasible: false, reason: 'too_few' };
    const idSet = new Set(ids);
    const pairs = exclusions
      .filter((e) => idSet.has(e.a) && idSet.has(e.b))
      .map((e) => [e.a, e.b] as [string, string]);
    if (!isFeasible(ids, forbiddenSet(pairs))) return { feasible: false, reason: 'restrictions' };
    return { feasible: true };
  }

  /** Add a (newly joined/approved) member to the group's current open edition as invited. */
  private async addToOpenEdition(tx: Transaction, groupId: string, userId: string): Promise<void> {
    const edition = await Edition.findOne({ where: { groupId, state: 'open' }, transaction: tx });
    if (!edition) return;
    const existing = await Participant.findOne({
      where: { editionId: edition.id, userId },
      transaction: tx,
    });
    if (!existing) {
      await Participant.create(
        { editionId: edition.id, userId, status: 'invited' },
        { transaction: tx },
      );
    }
  }

  // ─── Invite by email ──────────────────────────────────────────────────

  /**
   * Invite people to a group by email (admins). Each becomes an `invited`
   * membership and gets an email with a link that signs them in and lands on the
   * group. The response is uniform whether or not the email already has an
   * account (no enumeration); suppressed and already-member addresses are skipped.
   */
  async inviteByEmail(
    groupId: string,
    admin: SessionUser,
    invites: InviteEntryDto[],
  ): Promise<{ results: Array<{ email: string; status: 'invited' | 'skipped' | 'already_member' }> }> {
    await this.access.requireAdmin(groupId, admin.id);
    const group = await Group.findByPk(groupId);
    if (!group) throw new NotFoundException();

    const results: Array<{ email: string; status: 'invited' | 'skipped' | 'already_member' }> = [];
    for (const entry of invites) {
      const email = entry.email.trim().toLowerCase();
      const firstName = entry.firstName.trim();
      await this.rateLimit.hit('group_invite', admin.id, this.config.rateLimits.invitesPerAccount, DAY);

      if (await this.suppression.isSuppressed(email)) {
        results.push({ email, status: 'skipped' });
        continue;
      }

      const existingUser = await User.findOne({ where: { email } });
      const existing = existingUser
        ? await Membership.findOne({ where: { groupId, userId: existingUser.id } })
        : await Membership.findOne({ where: { groupId, invitedEmail: email, userId: null } });

      if (existing && existing.status !== 'invited') {
        // Already an active member or a pending join request — nothing to do.
        results.push({ email, status: 'already_member' });
        continue;
      }
      if (!existing) {
        await Membership.create({
          groupId,
          userId: existingUser?.id ?? null,
          invitedEmail: email,
          invitedFirstName: firstName,
          role: 'member',
          status: 'invited',
        });
      }
      await this.sendGroupInvite(email, admin, group); // (re)send
      results.push({ email, status: 'invited' });
    }
    return { results };
  }

  private async sendGroupInvite(email: string, admin: SessionUser, group: Group): Promise<void> {
    const link = await this.auth.createActionLink(email, `/groups/${group.id}`);
    const unsubscribeUrl = `${this.config.appUrl}/unsubscribe/${this.suppression.hashFor(email)}`;
    const lang = this.i18n.normalize(group.defaultLanguage);
    try {
      await this.mail.sendGroupInvitation(email, admin.firstName ?? 'A friend', group.name, link, unsubscribeUrl, lang);
    } catch {
      /* email failures must not fail the invite (same as edition invites) */
    }
  }

  /** The invitee accepts: their invited membership becomes active. */
  async acceptInvite(groupId: string, user: SessionUser): Promise<{ ok: true }> {
    const invited = await Membership.findOne({
      where: {
        groupId,
        status: 'invited',
        [Op.or]: [{ userId: user.id }, { invitedEmail: user.email }],
      },
    });
    if (!invited) throw new NotFoundException();

    await this.sequelize.transaction(async (tx) => {
      // If they already became an active member some other way, just drop the invite.
      const already = await Membership.findOne({
        where: { groupId, userId: user.id, status: 'active' },
        transaction: tx,
      });
      if (already) {
        await invited.destroy({ transaction: tx });
        return;
      }
      invited.userId = user.id;
      invited.status = 'active';
      await invited.save({ transaction: tx });
      await this.addToOpenEdition(tx, groupId, user.id);
      await Group.update({ lastActivityAt: new Date() }, { where: { id: groupId }, transaction: tx });
    });
    return { ok: true as const };
  }

  /** Cancel an outstanding email invite (admins). */
  async cancelInvite(groupId: string, membershipId: string, admin: SessionUser): Promise<{ ok: true }> {
    await this.access.requireAdmin(groupId, admin.id);
    const m = await Membership.findOne({ where: { id: membershipId, groupId, status: 'invited' } });
    if (!m) throw new NotFoundException();
    await m.destroy();
    return { ok: true as const };
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

    const memberCount = await Membership.count({ where: { groupId, status: 'active' } });
    if (memberCount <= 1) throw new ConflictException('delete_instead');
    if (membership.role === 'admin') {
      const adminCount = await Membership.count({ where: { groupId, role: 'admin', status: 'active' } });
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

  async listMyGroups(user: SessionUser): Promise<GroupSummary[]> {
    // Active memberships, plus groups you've been invited to by email (not yet accepted).
    const memberships = await Membership.findAll({
      where: {
        [Op.or]: [
          { userId: user.id, status: ['active', 'invited'] },
          { invitedEmail: user.email, status: 'invited' },
        ],
      },
    });
    const byGroup = new Map<string, Membership>();
    for (const m of memberships) {
      // Prefer an active row over an invited one if both somehow exist.
      const prev = byGroup.get(m.groupId);
      if (!prev || (prev.status === 'invited' && m.status === 'active')) byGroup.set(m.groupId, m);
    }

    const summaries: GroupSummary[] = [];
    for (const m of byGroup.values()) {
      const group = await Group.findByPk(m.groupId);
      if (!group) continue;
      if (m.status === 'invited') {
        // An invite you haven't accepted — show only the name + a Join prompt.
        summaries.push({
          id: group.id, name: group.name, defaultLanguage: group.defaultLanguage,
          role: 'member', myStatus: 'invited', memberCount: 0, pendingCount: 0, currentEdition: null,
        });
        continue;
      }
      const edition = await this.currentEdition(group.id);
      const memberCount = await Membership.count({ where: { groupId: group.id, status: 'active' } });
      const pendingCount =
        m.role === 'admin'
          ? await Membership.count({ where: { groupId: group.id, status: 'pending' } })
          : 0;
      summaries.push({
        id: group.id,
        name: group.name,
        defaultLanguage: group.defaultLanguage,
        role: m.role,
        myStatus: 'active',
        memberCount,
        pendingCount,
        currentEdition: edition ? await this.editionSummary(edition, user.id) : null,
      });
    }
    return summaries;
  }

  /** Active editions across the user's groups (drives the app Home). */
  async listMyActiveEditions(userId: string): Promise<EditionSummary[]> {
    const memberships = await Membership.findAll({ where: { userId, status: 'active' } });
    const out: EditionSummary[] = [];
    for (const m of memberships) {
      const group = await Group.findByPk(m.groupId);
      if (!group) continue;
      const edition = await this.currentEdition(group.id);
      if (!edition) continue;
      const participant = await Participant.findOne({ where: { editionId: edition.id, userId } });
      if (!participant) continue; // not one of your editions
      const summary = await this.editionSummary(edition, userId);
      out.push({ ...summary, groupId: group.id, groupName: group.name });
    }
    out.sort((a, b) => (a.daysToGo ?? 1e9) - (b.daysToGo ?? 1e9));
    return out;
  }

  async getGroupDetail(groupId: string, userId: string) {
    const membership = await this.access.requireMember(groupId, userId);
    const group = await Group.findByPk(groupId);
    if (!group) throw new NotFoundException();

    const isAdminViewer = membership.role === 'admin';
    const members = await Membership.findAll({
      where: { groupId, status: ['active', 'invited'] },
    });
    const memberDtos = await Promise.all(
      members.map(async (mem) => {
        const u = mem.userId ? await User.findByPk(mem.userId) : null;
        return {
          membershipId: mem.id,
          userId: mem.userId,
          firstName: u?.firstName ?? mem.invitedFirstName ?? null,
          lastName: u?.lastName ?? null,
          role: mem.role,
          status: mem.status as 'active' | 'invited',
          isYou: mem.userId === userId,
          // Only admins see the invited address, to manage the pending invite.
          invitedEmail: isAdminViewer && mem.status === 'invited' ? mem.invitedEmail : null,
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
      visibility: group.visibility,
      inviteUrl: isAdminViewer ? this.inviteUrl(group.inviteToken) : undefined,
      pendingCount: isAdminViewer ? await Membership.count({ where: { groupId, status: 'pending' } }) : 0,
      members: memberDtos,
      // A group with any drawn edition can't be deleted (irreversible history).
      hasDrawnEdition: editions.some((e) => e.drawnAt != null),
      editions: editions.map((e) => ({
        id: e.id,
        name: e.name,
        theme: e.theme,
        state: e.state,
        exchangeDate: e.exchangeDate,
      })),
    };
  }

  // ─── Group-level join & approval ──────────────────────────────────────

  /** Pre-auth: the join page shows only the group name and how joining works. */
  async groupJoinInfo(token: string) {
    const group = await Group.findOne({ where: { inviteToken: token } });
    if (!group) return { state: 'revoked' as const };
    return { state: 'open' as const, groupName: group.name, visibility: group.visibility };
  }

  /**
   * Join a group by its invite token. Semi-public groups add you immediately;
   * private groups create a pending request for an admin to approve.
   */
  async joinGroup(
    token: string,
    user: SessionUser,
  ): Promise<{ groupId: string; state: 'joined' | 'pending' }> {
    const group = await Group.findOne({ where: { inviteToken: token } });
    if (!group) throw new NotFoundException('revoked');

    return this.sequelize.transaction(async (tx) => {
      const existing = await Membership.findOne({
        where: { groupId: group.id, userId: user.id },
        transaction: tx,
      });
      if (existing) {
        return { groupId: group.id, state: existing.status === 'active' ? 'joined' : 'pending' };
      }

      const count = await Membership.count({
        where: { groupId: group.id, status: 'active' },
        transaction: tx,
      });
      if (count >= this.config.rateLimits.membersPerGroup) {
        throw new BadRequestException('group_full');
      }

      if (group.visibility === 'semi_public') {
        await Membership.create(
          { groupId: group.id, userId: user.id, role: 'member', status: 'active' },
          { transaction: tx },
        );
        await this.addToOpenEdition(tx, group.id, user.id);
        await Group.update(
          { lastActivityAt: new Date() },
          { where: { id: group.id }, transaction: tx },
        );
        return { groupId: group.id, state: 'joined' };
      }

      await Membership.create(
        { groupId: group.id, userId: user.id, role: 'member', status: 'pending' },
        { transaction: tx },
      );
      return { groupId: group.id, state: 'pending' };
    });
  }

  async listRequests(groupId: string, admin: SessionUser) {
    await this.access.requireAdmin(groupId, admin.id);
    const pending = await Membership.findAll({
      where: { groupId, status: 'pending' },
      order: [['createdAt', 'ASC']],
    });
    const requests = await Promise.all(
      pending.map(async (m) => {
        const u = await User.findByPk(m.userId);
        return {
          userId: m.userId,
          firstName: u?.firstName ?? null,
          lastName: u?.lastName ?? null,
          email: u?.email ?? null,
          requestedAt: m.createdAt,
        };
      }),
    );
    return { requests };
  }

  async approveRequest(groupId: string, targetUserId: string, admin: SessionUser): Promise<{ ok: true }> {
    await this.access.requireAdmin(groupId, admin.id);
    const req = await this.access.getPendingRequest(groupId, targetUserId);
    if (!req) throw new NotFoundException();
    await this.sequelize.transaction(async (tx) => {
      req.status = 'active';
      await req.save({ transaction: tx });
      await this.addToOpenEdition(tx, groupId, targetUserId);
      await Group.update({ lastActivityAt: new Date() }, { where: { id: groupId }, transaction: tx });
    });
    return { ok: true as const };
  }

  async rejectRequest(groupId: string, targetUserId: string, admin: SessionUser): Promise<{ ok: true }> {
    await this.access.requireAdmin(groupId, admin.id);
    const req = await this.access.getPendingRequest(groupId, targetUserId);
    if (!req) throw new NotFoundException();
    await req.destroy();
    return { ok: true as const };
  }

  async regenerateGroupInvite(groupId: string, admin: SessionUser): Promise<{ inviteUrl: string }> {
    await this.access.requireAdmin(groupId, admin.id);
    const group = await Group.findByPk(groupId);
    if (!group) throw new NotFoundException();
    group.inviteToken = randomUrlToken(16);
    await group.save();
    return { inviteUrl: this.inviteUrl(group.inviteToken) };
  }

  async saveGroupSettings(groupId: string, admin: SessionUser, dto: GroupSettingsDto): Promise<{ ok: true }> {
    await this.access.requireAdmin(groupId, admin.id);
    const group = await Group.findByPk(groupId);
    if (!group) throw new NotFoundException();
    if (dto.name !== undefined) group.name = dto.name.trim();
    if (dto.visibility !== undefined) group.visibility = dto.visibility as GroupVisibility;
    await group.save();
    return { ok: true as const };
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
