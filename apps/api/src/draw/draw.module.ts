import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GroupsModule } from '../groups/groups.module';
import { DrawService } from './draw.service';
import { DrawExecutionService } from './draw-execution.service';
import { DrawController } from './draw.controller';

@Module({
  imports: [AuthModule, GroupsModule],
  controllers: [DrawController],
  providers: [DrawService, DrawExecutionService],
  exports: [DrawService, DrawExecutionService],
})
export class DrawModule {}
