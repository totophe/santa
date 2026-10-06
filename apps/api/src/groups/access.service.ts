import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Edition,
  Group,
  Membership,
  Participant,
} from '../database/models';

export interface EditionContext {
  edition: Edition;
  group: Group;
  membership: Membership;
  isAdmin: boolean;
  participant: Participant | null;
}

/**
 * Central access checks. A resource the user may not see answers exactly like a
 * resource that does not exist (secrecy rule: "not found means not yours"), so
 * membership failures raise NotFound, not Forbidden.
 */
@Injectable()
export class AccessService {
  async getMembership(groupId: string, userId: string): Promise<Membership | null> {
    return Membership.findOne({ where: { groupId, userId } });
  }

  async requireMember(groupId: string, userId: string): Promise<Membership> {
    const membership = await this.getMembership(groupId, userId);
    if (!membership) throw new NotFoundException();
    return membership;
  }

  async requireAdmin(groupId: string, userId: string): Promise<Membership> {
    const membership = await this.requireMember(groupId, userId);
    if (membership.role !== 'admin') {
      // The user is a member, so revealing "admins only" leaks nothing.
      throw new ForbiddenException('admins only');
    }
    return membership;
  }

  /** Resolve an edition for a viewer, or 404 if they are not in its group. */
  async getEditionContext(editionId: string, userId: string): Promise<EditionContext> {
    const edition = await Edition.findByPk(editionId);
    if (!edition) throw new NotFoundException();
    const membership = await this.getMembership(edition.groupId, userId);
    if (!membership) throw new NotFoundException();
    const group = await Group.findByPk(edition.groupId);
    if (!group) throw new NotFoundException();
    const participant = await Participant.findOne({
      where: { editionId: edition.id, userId },
    });
    return {
      edition,
      group,
      membership,
      isAdmin: membership.role === 'admin',
      participant,
    };
  }
}
