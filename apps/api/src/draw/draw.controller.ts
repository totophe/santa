import { Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import type { SessionUser } from '../auth/auth.service';
import { DrawExecutionService } from './draw-execution.service';

@Controller('editions')
@UseGuards(SessionGuard)
export class DrawController {
  constructor(private readonly draw: DrawExecutionService) {}

  /** Run the draw (admin). */
  @Post(':id/draw')
  @HttpCode(200)
  run(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.draw.runDraw(id, user);
  }

  /** The draw card — never contains the recipient's name. */
  @Get(':id/draw')
  card(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.draw.getDrawCard(id, user);
  }

  /** The only endpoint that returns a recipient — the caller's own. */
  @Post(':id/reveal')
  @HttpCode(200)
  reveal(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.draw.reveal(id, user);
  }

  @Post(':id/open-chat')
  @HttpCode(200)
  openChat(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.draw.openChatNow(id, user);
  }
}
