import { Module } from '@nestjs/common';
import { DigestService } from './digest.service';
import { DigestController } from './digest.controller';

@Module({
  controllers: [DigestController],
  providers: [DigestService],
  exports: [DigestService],
})
export class DigestModule {}
