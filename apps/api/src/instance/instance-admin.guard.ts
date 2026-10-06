import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { CONFIG, type AppConfig } from '../config/env';
import type { SessionUser } from '../auth/auth.service';

/** Allows only the fixed list of instance-admin emails. Runs after SessionGuard. */
@Injectable()
export class InstanceAdminGuard implements CanActivate {
  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user?: SessionUser }>();
    const email = req.user?.email?.toLowerCase();
    if (!email || !this.config.instanceAdmins.includes(email)) {
      throw new ForbiddenException();
    }
    return true;
  }
}
