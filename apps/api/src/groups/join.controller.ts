import { Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import type { SessionUser } from '../auth/auth.service';
import { EditionsService } from './editions.service';

@Controller('join')
export class JoinController {
  constructor(private readonly editions: EditionsService) {}

  /** Public: before sign-in, shows only the group and edition names. */
  @Get(':token')
  info(@Param('token') token: string) {
    return this.editions.joinInfo(token);
  }

  @Post(':token')
  @HttpCode(200)
  @UseGuards(SessionGuard)
  join(@CurrentUser() user: SessionUser, @Param('token') token: string) {
    return this.editions.join(token, user);
  }
}
