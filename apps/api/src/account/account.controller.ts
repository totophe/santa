import { Controller, Delete, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser, SESSION_COOKIE, SessionGuard } from '../auth/session.guard';
import type { SessionUser } from '../auth/auth.service';
import { AccountService } from './account.service';

@Controller('account')
@UseGuards(SessionGuard)
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Delete()
  async remove(
    @CurrentUser() user: SessionUser,
    @Req() _req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.account.deleteAccount(user);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return result;
  }
}
