import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GroupsModule } from '../groups/groups.module';
import { PushModule } from '../push/push.module';
import { DrawService } from './draw.service';
import { DrawExecutionService } from './draw-execution.service';
import { DrawController } from './draw.controller';

@Module({
  imports: [AuthModule, GroupsModule, PushModule],
  controllers: [DrawController],
  providers: [DrawService, DrawExecutionService],
  exports: [DrawService, DrawExecutionService],
})
export class DrawModule {}
