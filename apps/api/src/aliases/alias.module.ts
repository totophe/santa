import { Global, Module } from '@nestjs/common';
import { AliasService } from './alias.service';

@Global()
@Module({
  providers: [AliasService],
  exports: [AliasService],
})
export class AliasModule {}
