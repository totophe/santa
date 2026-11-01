import { Body, Controller, Get, HttpCode, Param, Post, Put, UseGuards } from '@nestjs/common';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import type { SessionUser } from '../auth/auth.service';
import { GroupsService } from './groups.service';
import { CreateGroupDto, EditionInputDto, GroupSettingsDto } from './dto';

@Controller('groups')
@UseGuards(SessionGuard)
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  async list(@CurrentUser() user: SessionUser) {
    return { groups: await this.groups.listMyGroups(user.id) };
  }

  // Active editions across the user's groups (the app Home feed).
  // Two path segments, so it never collides with GET /groups/:id.
  @Get('mine/active-editions')
  async myEditions(@CurrentUser() user: SessionUser) {
    return { editions: await this.groups.listMyActiveEditions(user.id) };
  }

  @Post()
  async create(@CurrentUser() user: SessionUser, @Body() dto: CreateGroupDto) {
    const { group, edition, inviteUrl } = await this.groups.createGroupWithEdition(
      user,
      dto,
    );
    return {
      group: { id: group.id, name: group.name, defaultLanguage: group.defaultLanguage },
      edition: { id: edition.id, name: edition.name, theme: edition.theme, state: edition.state },
      inviteUrl,
    };
  }

  @Get(':id')
  async detail(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.groups.getGroupDetail(id, user.id);
  }

  // Start the next edition in an existing group (admins only).
  @Post(':groupId/editions')
  async createEdition(
    @CurrentUser() user: SessionUser,
    @Param('groupId') groupId: string,
    @Body() dto: EditionInputDto,
  ) {
    const { edition, inviteUrl } = await this.groups.createEdition(groupId, user, dto);
    return {
      edition: { id: edition.id, name: edition.name, theme: edition.theme, state: edition.state },
      inviteUrl,
    };
  }

  @Post(':groupId/leave')
  @HttpCode(200)
  async leave(@CurrentUser() user: SessionUser, @Param('groupId') groupId: string) {
    return this.groups.leaveGroup(groupId, user);
  }

  // ─── Group settings & invite (admin) ────────────────────────────────
  @Put(':groupId/settings')
  async settings(
    @CurrentUser() user: SessionUser,
    @Param('groupId') groupId: string,
    @Body() dto: GroupSettingsDto,
  ) {
    return this.groups.saveGroupSettings(groupId, user, dto);
  }

  @Post(':groupId/invite/regenerate')
  @HttpCode(200)
  async regenerateInvite(@CurrentUser() user: SessionUser, @Param('groupId') groupId: string) {
    return this.groups.regenerateGroupInvite(groupId, user);
  }

  // ─── Join requests (admin) ──────────────────────────────────────────
  @Get(':groupId/requests')
  async requests(@CurrentUser() user: SessionUser, @Param('groupId') groupId: string) {
    return this.groups.listRequests(groupId, user);
  }

  @Post(':groupId/requests/:userId/approve')
  @HttpCode(200)
  async approve(
    @CurrentUser() user: SessionUser,
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
  ) {
    return this.groups.approveRequest(groupId, userId, user);
  }

  @Post(':groupId/requests/:userId/reject')
  @HttpCode(200)
  async reject(
    @CurrentUser() user: SessionUser,
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
  ) {
    return this.groups.rejectRequest(groupId, userId, user);
  }
}
