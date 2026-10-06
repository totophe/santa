import {
  Body,
  Controller,
  Get,
  HttpCode,
  Ip,
  Post,
  Put,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Inject } from '@nestjs/common';
import { AuthService, type SessionUser, type VerifyResult } from './auth.service';
import { SignInDto, VerifyCodeDto, ProfileDto } from './dto';
import { CurrentUser, SESSION_COOKIE, SessionGuard } from './session.guard';
import { CONFIG, type AppConfig } from '../config/env';
import { RateLimitService, HOUR } from '../safety/rate-limit.service';

const SESSION_MAX_AGE_MS = 183 * 24 * 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly rateLimit: RateLimitService,
  ) {}

  /** Request a sign-in code + link. Always answers the same (no enumeration). */
  @Post('signin')
  @HttpCode(200)
  async signIn(@Body() dto: SignInDto, @Ip() ip: string): Promise<{ ok: true }> {
    const limits = this.config.rateLimits;
    await this.rateLimit.hit('signin_ip', ip || 'unknown', limits.signinPerIp, HOUR);
    await this.rateLimit.hit('signin_email', dto.email.trim().toLowerCase(), limits.signinPerEmail, HOUR);
    await this.auth.requestSignIn(dto.email, dto.target ?? null);
    return { ok: true };
  }

  @Post('verify')
  @HttpCode(200)
  async verify(
    @Body() dto: VerifyCodeDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: SessionUser; target: string | null }> {
    const result = await this.auth.verifyCode(
      dto.email,
      dto.code,
      dto.sharedDevice ?? false,
    );
    if (!result) throw new UnauthorizedException('invalid_code');
    this.setSessionCookie(res, result);
    return { user: result.user, target: result.target };
  }

  /** Magic-link landing: sign in, then redirect to the target (or home). */
  @Get('link')
  async link(
    @Query('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const result = token ? await this.auth.verifyLink(token) : null;
    if (!result) {
      res.redirect(302, `${this.config.appUrl}/signin?link=expired`);
      return;
    }
    this.setSessionCookie(res, result);
    const target = result.target && result.target.startsWith('/')
      ? result.target
      : '/';
    res.redirect(302, `${this.config.appUrl}${target}`);
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@CurrentUser() user: SessionUser): { user: SessionUser } {
    return { user };
  }

  @Put('profile')
  @UseGuards(SessionGuard)
  async profile(
    @CurrentUser() user: SessionUser,
    @Body() dto: ProfileDto,
  ): Promise<{ user: SessionUser }> {
    const updated = await this.auth.updateProfile(user.id, {
      firstName: dto.firstName,
      lastName: dto.lastName ?? null,
      language: dto.language,
    });
    if (!updated) throw new UnauthorizedException();
    return { user: updated };
  }

  @Post('signout')
  @HttpCode(200)
  async signOut(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    const token = req.cookies?.[SESSION_COOKIE];
    if (token) await this.auth.signOut(token);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  }

  private setSessionCookie(res: Response, result: VerifyResult): void {
    res.cookie(SESSION_COOKIE, result.sessionToken, {
      httpOnly: true,
      secure: this.config.appUrl.startsWith('https'),
      sameSite: 'lax',
      path: '/',
      // Persistent sessions get a max-age; shared-device sessions are
      // session cookies that end with the browser.
      ...(result.persistent ? { maxAge: SESSION_MAX_AGE_MS } : {}),
    });
  }
}
