import { Global, Module } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';
import { SuppressionService } from './suppression.service';
import { UnsubscribeController } from './unsubscribe.controller';

@Global()
@Module({
  controllers: [UnsubscribeController],
  providers: [RateLimitService, SuppressionService],
  exports: [RateLimitService, SuppressionService],
})
export class SafetyModule {}
