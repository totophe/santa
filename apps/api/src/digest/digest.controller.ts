import { Controller, Get, Param } from '@nestjs/common';
import { DigestService } from './digest.service';

/** Public (no sign-in): the one-click unsubscribe link in each digest email. */
@Controller('digest')
export class DigestController {
  constructor(private readonly digest: DigestService) {}

  @Get('unsubscribe/:userId/:hash')
  unsubscribe(@Param('userId') userId: string, @Param('hash') hash: string) {
    return this.digest.unsubscribe(userId, hash);
  }
}
