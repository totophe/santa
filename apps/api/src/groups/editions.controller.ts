import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import type { SessionUser } from '../auth/auth.service';
import { EditionsService } from './editions.service';

@Controller('editions')
@UseGuards(SessionGuard)
export class EditionsController {
  constructor(private readonly editions: EditionsService) {}

  @Get(':id')
  detail(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.editions.getEditionDetail(id, user);
  }

  @Get(':id/participants')
  participants(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.editions.listParticipants(id, user);
  }

  @Post(':id/confirm')
  @HttpCode(200)
  async confirm(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    await this.editions.confirm(id, user);
    return { ok: true };
  }

  @Post(':id/decline')
  @HttpCode(200)
  async decline(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    await this.editions.decline(id, user);
    return { ok: true };
  }

  @Post(':id/invite/regenerate')
  @HttpCode(200)
  regenerate(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.editions.regenerateInvite(id, user);
  }
}
