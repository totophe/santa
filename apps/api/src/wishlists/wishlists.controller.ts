import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import type { SessionUser } from '../auth/auth.service';
import { WishlistsService } from './wishlists.service';
import { AddItemDto, ImportDto, PasteDto, ReorderDto, UpdateItemDto } from './dto';

@Controller()
@UseGuards(SessionGuard)
export class WishlistsController {
  constructor(private readonly wishlists: WishlistsService) {}

  // Reading
  @Get('editions/:id/wishlists')
  list(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.wishlists.listWishlists(id, user);
  }

  @Get('editions/:id/wishlists/:participantId')
  one(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Param('participantId') participantId: string,
  ) {
    return this.wishlists.getParticipantWishlist(id, participantId, user);
  }

  @Get('wishlists/importable')
  importable(@CurrentUser() user: SessionUser) {
    return this.wishlists.importable(user);
  }

  // My wishlist
  @Get('editions/:id/my-wishlist')
  mine(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.wishlists.getMyWishlist(id, user);
  }

  @Post('editions/:id/my-wishlist/items')
  addItem(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() dto: AddItemDto) {
    return this.wishlists.addItem(id, user, dto);
  }

  @Post('editions/:id/my-wishlist/paste')
  paste(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() dto: PasteDto) {
    return this.wishlists.paste(id, user, dto.text);
  }

  @Put('wishlist-items/:itemId')
  updateItem(
    @CurrentUser() user: SessionUser,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.wishlists.updateItem(itemId, user, dto);
  }

  @Delete('wishlist-items/:itemId')
  deleteItem(@CurrentUser() user: SessionUser, @Param('itemId') itemId: string) {
    return this.wishlists.deleteItem(itemId, user);
  }

  @Post('editions/:id/my-wishlist/reorder')
  reorder(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() dto: ReorderDto) {
    return this.wishlists.reorder(id, user, dto.itemIds);
  }

  @Post('editions/:id/my-wishlist/publish')
  @HttpCode(200)
  publish(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.wishlists.publish(id, user);
  }

  @Post('editions/:id/my-wishlist/surprise')
  @HttpCode(200)
  surprise(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.wishlists.setSurprise(id, user);
  }

  @Post('editions/:id/my-wishlist/unsurprise')
  @HttpCode(200)
  unsurprise(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.wishlists.unsetSurprise(id, user);
  }

  @Post('editions/:id/my-wishlist/import')
  @HttpCode(200)
  import(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() dto: ImportDto) {
    return this.wishlists.importItems(id, user, dto.sourceWishlistId, dto.itemIds);
  }
}
