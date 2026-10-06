import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InstanceService } from './instance.service';
import { InstanceController } from './instance.controller';
import { InstanceAdminGuard } from './instance-admin.guard';

@Module({
  imports: [AuthModule],
  controllers: [InstanceController],
  providers: [InstanceService, InstanceAdminGuard],
})
export class InstanceModule {}
