import { Controller, Get, Param } from '@nestjs/common';
import { SuppressionService } from './suppression.service';

@Controller('unsubscribe')
export class UnsubscribeController {
  constructor(private readonly suppression: SuppressionService) {}

  /** Public: the invitation's unsubscribe link carries the keyed hash directly. */
  @Get(':hash')
  async unsubscribe(@Param('hash') hash: string): Promise<{ ok: true }> {
    await this.suppression.suppressByHash(hash);
    return { ok: true };
  }
}
