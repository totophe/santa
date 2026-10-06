import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccessService } from './access.service';
import { GroupsService } from './groups.service';
import { EditionsService } from './editions.service';
import { GroupsController } from './groups.controller';
import { EditionsController } from './editions.controller';
import { JoinController } from './join.controller';

@Module({
  imports: [AuthModule],
  controllers: [GroupsController, EditionsController, JoinController],
  providers: [AccessService, GroupsService, EditionsService],
  exports: [AccessService, GroupsService, EditionsService],
})
export class GroupsModule {}
