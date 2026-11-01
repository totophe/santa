import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GroupsModule } from '../groups/groups.module';
import { PushModule } from '../push/push.module';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';

@Module({
  imports: [AuthModule, GroupsModule, PushModule],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
