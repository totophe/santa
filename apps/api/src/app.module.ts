import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { CryptoModule } from './crypto/crypto.module';
import { DatabaseModule } from './database/database.module';
import { I18nModule } from './i18n/i18n.module';
import { MailModule } from './mail/mail.module';
import { AliasModule } from './aliases/alias.module';
import { SafetyModule } from './safety/safety.module';
import { AuthModule } from './auth/auth.module';
import { GroupsModule } from './groups/groups.module';
import { WishlistsModule } from './wishlists/wishlists.module';
import { MessagesModule } from './messages/messages.module';
import { AdminModule } from './admin/admin.module';
import { AccountModule } from './account/account.module';
import { InstanceModule } from './instance/instance.module';
import { PrivacyModule } from './privacy/privacy.module';
import { DrawModule } from './draw/draw.module';
import { HealthModule } from './health/health.module';
import { MetaModule } from './meta/meta.module';

@Module({
  imports: [
    ConfigModule,
    CryptoModule,
    DatabaseModule,
    I18nModule,
    MailModule,
    AliasModule,
    SafetyModule,
    AuthModule,
    GroupsModule,
    WishlistsModule,
    MessagesModule,
    AdminModule,
    AccountModule,
    InstanceModule,
    PrivacyModule,
    DrawModule,
    HealthModule,
    MetaModule,
  ],
})
export class AppModule {}
