import { Injectable, NotFoundException } from '@nestjs/common';
import { Edition, Group, Membership, Participant, User } from '../database/models';

// Invariant #1 (draw secrecy): everything here is counts/metadata only. No
// endpoint in this service may ever return an assignment, a recipient, or any
// giver→recipient correlation — not even to an instance admin.
@Injectable()
export class InstanceService {
  async overview() {
    const [accounts, groupCount, editionCount] = await Promise.all([
      User.count(),
      Group.count(),
      Edition.count(),
    ]);
    const groups = await Group.findAll({ order: [['lastActivityAt', 'DESC']] });
    const list = await Promise.all(
      groups.map(async (g) => {
        const creator = g.createdBy ? await User.findByPk(g.createdBy) : null;
        const editions = await Edition.findAll({
          where: { groupId: g.id },
          order: [['createdAt', 'DESC']],
        });
        const editionList = await Promise.all(
          editions.map(async (e) => ({
            id: e.id,
            name: e.name,
            theme: e.theme,
            state: e.state,
            exchangeDate: e.exchangeDate,
            participants: await Participant.count({ where: { editionId: e.id } }),
            confirmed: await Participant.count({ where: { editionId: e.id, status: 'confirmed' } }),
            drawn: e.state !== 'open', // never who-gives-to-whom, just "a draw happened"
          })),
        );
        return {
          id: g.id,
          name: g.name,
          creatorEmail: creator?.email ?? null,
          memberCount: await Membership.count({ where: { groupId: g.id } }),
          editionCount: editions.length,
          createdAt: g.createdAt,
          lastActivityAt: g.lastActivityAt,
          editions: editionList,
        };
      }),
    );
    // Counts only — never any group content.
    return { totals: { accounts, groups: groupCount, editions: editionCount }, groups: list };
  }

  async users() {
    const users = await User.findAll({ order: [['createdAt', 'DESC']] });
    const list = await Promise.all(
      users.map(async (u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        createdAt: u.createdAt,
        lastSeenAt: u.lastSeenAt,
        groupCount: await Membership.count({ where: { userId: u.id } }),
      })),
    );
    return { users: list };
  }

  async deleteGroup(groupId: string) {
    const group = await Group.findByPk(groupId);
    if (!group) throw new NotFoundException();
    await group.destroy();
    return { ok: true as const };
  }
}
