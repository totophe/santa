import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Edition,
  Group,
  Membership,
  Participant,
  Session,
  User,
  Wishlist,
} from '../database/models';
import type { SessionUser } from '../auth/auth.service';
import { AdminService } from '../admin/admin.service';

@Injectable()
export class AccountService {
  constructor(private readonly admin: AdminService) {}

  /**
   * Delete an account: leave every group under the normal rules (departure
   * repair where a draw has run), then delete the user, sessions and wishlists.
   * Past participant rows become "Former member" (userId nulled by the FK), and
   * chat messages stay under their alias. Blocked while the user is the only
   * admin of a group that has other members.
   */
  async deleteAccount(user: SessionUser): Promise<{ ok: true }> {
    const memberships = await Membership.findAll({ where: { userId: user.id } });

    // Block if sole admin of a group that has other members.
    for (const m of memberships) {
      if (m.role !== 'admin') continue;
      const adminCount = await Membership.count({ where: { groupId: m.groupId, role: 'admin' } });
      const memberCount = await Membership.count({ where: { groupId: m.groupId } });
      if (adminCount === 1 && memberCount > 1) {
        throw new ConflictException('name_a_successor_first');
      }
    }

    // Leave non-archived editions (repair if drawn); archived rows are kept and
    // become "Former member" when the user row is deleted (FK sets userId null).
    const participants = await Participant.findAll({ where: { userId: user.id } });
    for (const p of participants) {
      const edition = await Edition.findByPk(p.editionId);
      if (edition && edition.state !== 'archived') {
        await this.admin.applyRemoval(edition, p);
      }
    }

    // Delete the user's wishlists (any remaining archived participant rows).
    const remaining = await Participant.findAll({ where: { userId: user.id } });
    for (const p of remaining) {
      await Wishlist.destroy({ where: { participantId: p.id } });
    }

    const groupIds = memberships.map((m) => m.groupId);
    await Session.destroy({ where: { userId: user.id } });

    const userRow = await User.findByPk(user.id);
    if (!userRow) throw new NotFoundException();
    await userRow.destroy(); // cascades memberships; nulls archived participant.userId

    // A group with no members left is deleted.
    for (const gid of groupIds) {
      const left = await Membership.count({ where: { groupId: gid } });
      if (left === 0) await Group.destroy({ where: { id: gid } });
    }

    return { ok: true };
  }
}
