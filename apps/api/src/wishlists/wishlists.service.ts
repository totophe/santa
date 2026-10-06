import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Edition,
  Group,
  Participant,
  User,
  Wishlist,
  WishlistItem,
} from '../database/models';
import type { SessionUser } from '../auth/auth.service';
import { AccessService } from '../groups/access.service';
import type { AddItemDto, UpdateItemDto } from './dto';

export interface ItemDto {
  id: string;
  text: string;
  url: string | null;
  price: string | null;
  note: string | null;
  addedAt: Date;
}

@Injectable()
export class WishlistsService {
  constructor(private readonly access: AccessService) {}

  // ─── My wishlist ──────────────────────────────────────────────────────

  private async myParticipant(editionId: string, user: SessionUser): Promise<{ participant: Participant; edition: Edition }> {
    const ctx = await this.access.getEditionContext(editionId, user.id);
    if (!ctx.participant) throw new NotFoundException();
    if (ctx.participant.status !== 'confirmed') {
      throw new ConflictException('confirm_first');
    }
    if (ctx.edition.state === 'archived') throw new ConflictException('archived');
    return { participant: ctx.participant, edition: ctx.edition };
  }

  private async getOrCreate(participantId: string): Promise<Wishlist> {
    const [wl] = await Wishlist.findOrCreate({
      where: { participantId },
      defaults: { participantId, state: 'draft', updatedAt: new Date() },
    });
    return wl;
  }

  async getMyWishlist(editionId: string, user: SessionUser) {
    const { participant } = await this.myParticipant(editionId, user);
    const wl = await this.getOrCreate(participant.id);
    return this.serializeOwn(wl);
  }

  async addItem(editionId: string, user: SessionUser, dto: AddItemDto) {
    const { participant } = await this.myParticipant(editionId, user);
    const wl = await this.getOrCreate(participant.id);
    const max = (await WishlistItem.max('position', { where: { wishlistId: wl.id } })) as number | null;
    await WishlistItem.create({
      wishlistId: wl.id,
      position: (max ?? -1) + 1,
      text: dto.text.trim(),
      url: dto.url ?? null,
      price: dto.price ?? null,
      note: dto.note ?? null,
    });
    await this.touch(wl);
    return this.serializeOwn(wl);
  }

  async paste(editionId: string, user: SessionUser, text: string) {
    const { participant } = await this.myParticipant(editionId, user);
    const wl = await this.getOrCreate(participant.id);
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 200);
    let pos = ((await WishlistItem.max('position', { where: { wishlistId: wl.id } })) as number | null) ?? -1;
    for (const line of lines) {
      pos += 1;
      await WishlistItem.create({ wishlistId: wl.id, position: pos, text: line.slice(0, 200) });
    }
    await this.touch(wl);
    return this.serializeOwn(wl);
  }

  async updateItem(itemId: string, user: SessionUser, dto: UpdateItemDto) {
    const { item, wl } = await this.ownItem(itemId, user);
    if (dto.text !== undefined) item.text = dto.text.trim();
    if (dto.url !== undefined) item.url = dto.url;
    if (dto.price !== undefined) item.price = dto.price;
    if (dto.note !== undefined) item.note = dto.note;
    await item.save();
    await this.touch(wl);
    return this.serializeOwn(wl);
  }

  async deleteItem(itemId: string, user: SessionUser) {
    const { item, wl } = await this.ownItem(itemId, user);
    await item.destroy();
    // A published list that loses its last item returns to draft.
    const remaining = await WishlistItem.count({ where: { wishlistId: wl.id } });
    if (remaining === 0 && wl.state === 'published') {
      wl.state = 'draft';
      wl.publishedAt = null;
    }
    await this.touch(wl);
    return this.serializeOwn(wl);
  }

  async reorder(editionId: string, user: SessionUser, itemIds: string[]) {
    const { participant } = await this.myParticipant(editionId, user);
    const wl = await this.getOrCreate(participant.id);
    const items = await WishlistItem.findAll({ where: { wishlistId: wl.id } });
    const owned = new Set(items.map((i) => i.id));
    let pos = 0;
    for (const id of itemIds) {
      if (!owned.has(id)) continue;
      await WishlistItem.update({ position: pos++ }, { where: { id } });
    }
    await this.touch(wl);
    return this.serializeOwn(wl);
  }

  async publish(editionId: string, user: SessionUser) {
    const { participant } = await this.myParticipant(editionId, user);
    const wl = await this.getOrCreate(participant.id);
    const count = await WishlistItem.count({ where: { wishlistId: wl.id } });
    if (count === 0) throw new BadRequestException('needs_an_item');
    wl.state = 'published';
    wl.publishedAt = new Date();
    await this.touch(wl);
    return this.serializeOwn(wl);
  }

  async setSurprise(editionId: string, user: SessionUser) {
    const { participant } = await this.myParticipant(editionId, user);
    const wl = await this.getOrCreate(participant.id);
    wl.state = 'surprise';
    wl.publishedAt = null;
    await this.touch(wl);
    return this.serializeOwn(wl);
  }

  async unsetSurprise(editionId: string, user: SessionUser) {
    const { participant } = await this.myParticipant(editionId, user);
    const wl = await this.getOrCreate(participant.id);
    // Restore the draft (items were kept hidden); it must be published again.
    wl.state = 'draft';
    await this.touch(wl);
    return this.serializeOwn(wl);
  }

  // ─── Reading others' lists ────────────────────────────────────────────

  async listWishlists(editionId: string, user: SessionUser) {
    const ctx = await this.access.getEditionContext(editionId, user.id);
    const participants = await Participant.findAll({ where: { editionId } });
    const rows = await Promise.all(
      participants.map(async (p) => {
        const wl = await Wishlist.findOne({ where: { participantId: p.id } });
        const u = p.userId ? await User.findByPk(p.userId) : null;
        return {
          participantId: p.id,
          firstName: (u?.firstName ?? p.invitedFirstName ?? '…').trim(),
          isYou: p.userId === user.id,
          icon: this.icon(wl),
        };
      }),
    );
    rows.sort((a, b) => (a.isYou === b.isYou ? 0 : a.isYou ? -1 : 1));
    return { wishlists: rows, canRead: !!ctx.participant || ctx.isAdmin };
  }

  async getParticipantWishlist(editionId: string, participantId: string, user: SessionUser) {
    const ctx = await this.access.getEditionContext(editionId, user.id);
    if (!ctx.participant && !ctx.isAdmin) throw new ForbiddenException();
    const participant = await Participant.findOne({ where: { id: participantId, editionId } });
    if (!participant) throw new NotFoundException();
    const wl = await Wishlist.findOne({ where: { participantId } });
    if (!wl || wl.state === 'draft') return { state: 'not_yet' as const };
    if (wl.state === 'surprise') return { state: 'surprise' as const };
    return {
      state: 'published' as const,
      updatedAt: wl.updatedAt,
      items: await this.items(wl.id),
    };
  }

  async importable(user: SessionUser) {
    // The user's own earlier lists, in any group/edition, that have items.
    const myParticipants = await Participant.findAll({ where: { userId: user.id } });
    const out: Array<{ wishlistId: string; groupName: string; editionName: string; itemCount: number }> = [];
    for (const p of myParticipants) {
      const wl = await Wishlist.findOne({ where: { participantId: p.id } });
      if (!wl) continue;
      const itemCount = await WishlistItem.count({ where: { wishlistId: wl.id } });
      if (itemCount === 0) continue;
      const edition = await Edition.findByPk(p.editionId);
      if (!edition) continue;
      const group = await Group.findByPk(edition.groupId);
      out.push({
        wishlistId: wl.id,
        groupName: group?.name ?? '',
        editionName: edition.name,
        itemCount,
      });
    }
    return { lists: out };
  }

  async importItems(editionId: string, user: SessionUser, sourceWishlistId: string, itemIds: string[]) {
    const { participant } = await this.myParticipant(editionId, user);
    // The source must be the user's own list.
    const source = await Wishlist.findByPk(sourceWishlistId);
    if (!source) throw new NotFoundException();
    const sourceParticipant = await Participant.findByPk(source.participantId);
    if (!sourceParticipant || sourceParticipant.userId !== user.id) {
      throw new ForbiddenException();
    }
    const dest = await this.getOrCreate(participant.id);
    const picked = await WishlistItem.findAll({ where: { wishlistId: sourceWishlistId } });
    const wanted = new Set(itemIds);
    let pos = ((await WishlistItem.max('position', { where: { wishlistId: dest.id } })) as number | null) ?? -1;
    for (const item of picked) {
      if (!wanted.has(item.id)) continue;
      pos += 1;
      // Copies keep no link to the source.
      await WishlistItem.create({
        wishlistId: dest.id,
        position: pos,
        text: item.text,
        url: item.url,
        price: item.price,
        note: item.note,
      });
    }
    await this.touch(dest);
    return this.serializeOwn(dest);
  }

  // ─── helpers ──────────────────────────────────────────────────────────

  private async ownItem(itemId: string, user: SessionUser): Promise<{ item: WishlistItem; wl: Wishlist }> {
    const item = await WishlistItem.findByPk(itemId);
    if (!item) throw new NotFoundException();
    const wl = await Wishlist.findByPk(item.wishlistId);
    if (!wl) throw new NotFoundException();
    const participant = await Participant.findByPk(wl.participantId);
    if (!participant || participant.userId !== user.id) throw new ForbiddenException();
    const edition = await Edition.findByPk(participant.editionId);
    if (edition?.state === 'archived') throw new ConflictException('archived');
    return { item, wl };
  }

  private async items(wishlistId: string): Promise<ItemDto[]> {
    const items = await WishlistItem.findAll({
      where: { wishlistId },
      order: [['position', 'ASC'], ['createdAt', 'ASC']],
    });
    return items.map((i) => ({
      id: i.id,
      text: i.text,
      url: i.url,
      price: i.price,
      note: i.note,
      addedAt: i.createdAt,
    }));
  }

  private async serializeOwn(wl: Wishlist) {
    return {
      state: wl.state,
      publishedAt: wl.publishedAt,
      updatedAt: wl.updatedAt,
      items: await this.items(wl.id),
    };
  }

  private icon(wl: Wishlist | null): 'published' | 'surprise' | 'not_yet' {
    if (!wl) return 'not_yet';
    if (wl.state === 'published') return 'published';
    if (wl.state === 'surprise') return 'surprise';
    return 'not_yet';
  }

  private async touch(wl: Wishlist): Promise<void> {
    wl.updatedAt = new Date();
    await wl.save();
  }
}
