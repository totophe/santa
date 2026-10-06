import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, type SessionUser } from './auth.service';

export const SESSION_COOKIE = 'santa_session';

interface RequestWithUser extends Request {
  user?: SessionUser;
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) throw new UnauthorizedException();
    const user = await this.auth.resolveSession(token);
    if (!user) throw new UnauthorizedException();
    req.user = user;
    return true;
  }
}

/** Injects the authenticated user resolved by SessionGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionUser => {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    return req.user as SessionUser;
  },
);
