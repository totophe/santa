import { Injectable, NotFoundException } from '@nestjs/common';
import { Edition, Group, Membership, User } from '../database/models';

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
        return {
          id: g.id,
          name: g.name,
          creatorEmail: creator?.email ?? null,
          memberCount: await Membership.count({ where: { groupId: g.id } }),
          editionCount: await Edition.count({ where: { groupId: g.id } }),
          createdAt: g.createdAt,
          lastActivityAt: g.lastActivityAt,
        };
      }),
    );
    // Counts only — never any group content.
    return { totals: { accounts, groups: groupCount, editions: editionCount }, groups: list };
  }

  async deleteGroup(groupId: string) {
    const group = await Group.findByPk(groupId);
    if (!group) throw new NotFoundException();
    await group.destroy();
    return { ok: true as const };
  }
}
