import { Controller, Delete, Get, Param, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import { InstanceAdminGuard } from './instance-admin.guard';
import { InstanceService } from './instance.service';

@Controller('instance')
@UseGuards(SessionGuard, InstanceAdminGuard)
export class InstanceController {
  constructor(private readonly instance: InstanceService) {}

  @Get()
  overview() {
    return this.instance.overview();
  }

  @Delete('groups/:groupId')
  deleteGroup(@Param('groupId') groupId: string) {
    return this.instance.deleteGroup(groupId);
  }
}
