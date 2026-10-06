import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import type { SessionUser } from '../auth/auth.service';
import { AdminService } from './admin.service';
import { DeleteGroupDto, EditionSettingsDto, SetRoleDto, TypedInviteDto } from './dto';

@Controller()
@UseGuards(SessionGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Post('editions/:id/participants/typed-invite')
  @HttpCode(200)
  typedInvite(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() dto: TypedInviteDto) {
    return this.admin.typedInvite(id, user, dto.firstName, dto.email);
  }

  @Post('editions/:id/participants/:pid/resend')
  @HttpCode(200)
  resend(@CurrentUser() user: SessionUser, @Param('id') id: string, @Param('pid') pid: string) {
    return this.admin.resend(id, pid, user);
  }

  @Delete('editions/:id/participants/:pid')
  remove(@CurrentUser() user: SessionUser, @Param('id') id: string, @Param('pid') pid: string) {
    return this.admin.removeParticipant(id, pid, user);
  }

  @Put('groups/:groupId/members/:userId/role')
  setRole(
    @CurrentUser() user: SessionUser,
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
    @Body() dto: SetRoleDto,
  ) {
    return this.admin.setRole(groupId, userId, dto.role, user);
  }

  @Put('editions/:id/settings')
  settings(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() dto: EditionSettingsDto) {
    return this.admin.updateEditionSettings(id, user, dto);
  }

  @Post('editions/:id/archive')
  @HttpCode(200)
  archive(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.admin.archiveEdition(id, user);
  }

  @Delete('groups/:groupId')
  deleteGroup(
    @CurrentUser() user: SessionUser,
    @Param('groupId') groupId: string,
    @Body() dto: DeleteGroupDto,
  ) {
    return this.admin.deleteGroup(groupId, user, dto.confirmName);
  }
}
