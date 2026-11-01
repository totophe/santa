import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import type { SessionUser } from '../auth/auth.service';
import { RateLimitService, DAY } from '../safety/rate-limit.service';
import { PushService } from './push.service';
import { SubscribeDto, UnsubscribeDto } from './push.dto';

@Controller('push')
@UseGuards(SessionGuard)
export class PushController {
  constructor(
    private readonly push: PushService,
    private readonly rateLimit: RateLimitService,
  ) {}

  @Post('subscribe')
  @HttpCode(200)
  async subscribe(@CurrentUser() user: SessionUser, @Body() dto: SubscribeDto) {
    await this.rateLimit.hit('push_subscribe', user.id, 50, DAY);
    await this.push.subscribe(user.id, dto.endpoint, dto.keys.p256dh, dto.keys.auth);
    return { ok: true as const };
  }

  @Post('unsubscribe')
  @HttpCode(200)
  async unsubscribe(@CurrentUser() user: SessionUser, @Body() dto: UnsubscribeDto) {
    await this.push.unsubscribe(user.id, dto.endpoint);
    return { ok: true as const };
  }
}
