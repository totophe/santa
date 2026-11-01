import { Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import type { SessionUser } from '../auth/auth.service';
import { GroupsService } from './groups.service';

@Controller('join')
export class JoinController {
  constructor(private readonly groups: GroupsService) {}

  /** Public: before sign-in, shows only the group name and how joining works. */
  @Get(':token')
  info(@Param('token') token: string) {
    return this.groups.groupJoinInfo(token);
  }

  @Post(':token')
  @HttpCode(200)
  @UseGuards(SessionGuard)
  join(@CurrentUser() user: SessionUser, @Param('token') token: string) {
    return this.groups.joinGroup(token, user);
  }
}
