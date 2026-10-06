import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminModule } from '../admin/admin.module';
import { AccountService } from './account.service';
import { AccountController } from './account.controller';

@Module({
  imports: [AuthModule, AdminModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
