import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import type { SessionUser } from '../auth/auth.service';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto';

@Controller('groups')
@UseGuards(SessionGuard)
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  async list(@CurrentUser() user: SessionUser) {
    return { groups: await this.groups.listMyGroups(user.id) };
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
}
